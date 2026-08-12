import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { Patterns } from '@geo/contracts';
import { sendRpc } from '../common/rpc';
import { CompetitorReviewsFetcherService } from './competitor-reviews-fetcher.service';

// Сеть/AI-звенья пайплайна (поиск конкурентов, MapVisibility-сопоставление) —
// внешние запросы к 2ГИС/Яндексу, может занять десятки секунд (тот же порядок,
// что и в company-visibility, см. VISIBILITY_CHECK_TIMEOUT там).
const RPC_TIMEOUT = 30000;

// Тот же принцип батчинга, что в MapVisibilityService.checkVisibility —
// сеть в 50 точек не должна улететь в rate limit 2ГИС/Яндекса/map-parser
// разом.
const BRAND_BATCH_CONCURRENCY = 5;

// Скрапинг отзывов каждого конкурента поднимает отдельный headless Chromium
// в map-parser (Playwright — реальный OS-процесс, не поток). Без лимита
// Promise.all запускал их все разом (до 5) — живьём поймали OOM-killer на
// этом (см. REFACTORING_LOG.md/память сессии 2026-08-11). 2 — компромисс
// между скоростью и памятью на типичной dev-машине.
const COMPETITOR_REVIEWS_CONCURRENCY = 2;

interface PlaceSourceRef {
  provider: '2gis' | 'yandex';
  id: string;
  raw: unknown;
}

interface CompanyGetResult {
  id: string;
  name: string;
  coordinates: [number, number] | null;
  rating: number | null;
  reviewCount: number;
  card: { fields: Record<string, { default?: unknown }> };
}

interface MapVisibilityResultRef {
  companyId: string;
  byProvider: {
    yandex: { matchedItem?: { sources: PlaceSourceRef[] } };
  };
}

interface CompetitorListingRef {
  name: string;
  phone?: string;
  categories?: string[];
  rating?: number;
  reviewCount?: number;
  sources: PlaceSourceRef[];
}

interface CompetitorInsights {
  cardComparison: Record<string, unknown>;
  ratingComparison: Record<string, unknown>;
  textAnalysis: Record<string, unknown> | null;
}

export interface SavedCompetitorAnalysisReport {
  id: string;
  companyId: string;
  createdAt: string;
}

export interface CompetitorAnalysisReportDetails {
  id: string;
  companyId: string;
  competitors: unknown[];
  cardComparison: Record<string, unknown>;
  ratingComparison: Record<string, unknown>;
  textAnalysis: Record<string, unknown> | null;
  createdAt: string;
}

interface CompanyForListing {
  id: string;
  name: string;
  addressDisplay: string | null;
  coordinates: [number, number] | null;
}

export interface BrandGenerationResult {
  companyId: string;
  success: boolean;
  report?: SavedCompetitorAnalysisReport;
  // Генерация для одной компании упала (сеть/AI/скрапинг) — не валит весь
  // батч, остальные компании бренда всё равно обрабатываются (partial
  // success, тот же принцип, что в PlacesSearchService/MapVisibilityService).
  error?: string;
}

// Оркестрация генерации CompetitorAnalysisReport на одну Company (см.
// docs/refactor-plans/competitor-analysis-report.md, коммит 6) — собирает
// шаги 1-6 плана: своя карточка (core-service) → свой листинг на Яндексе
// (MapVisibility, integration-service) → конкуренты (integration-service) →
// отзывы (map-parser, только Яндекс — см. коммит 4) → сравнение (ai-service)
// → сохранение (core-service).
@Injectable()
export class CompetitorAnalysisOrchestratorService {
  constructor(
    @Inject('CORE_SERVICE') private readonly coreClient: ClientProxy,
    @Inject('INTEGRATION_SERVICE')
    private readonly integrationClient: ClientProxy,
    @Inject('AI_SERVICE') private readonly aiClient: ClientProxy,
    private readonly reviewsFetcher: CompetitorReviewsFetcherService,
  ) {}

  async generateForCompany(companyId: string, brandId: string, userId: string) {
    const company = await sendRpc<CompanyGetResult>(
      this.coreClient,
      Patterns.COMPANY_GET,
      { companyId, brandId, userId },
    );

    const companyRef = {
      id: company.id,
      name: company.name,
      coordinates: company.coordinates,
    };

    const [visibilityResults, competitors] = await Promise.all([
      sendRpc<MapVisibilityResultRef[]>(
        this.integrationClient,
        Patterns.MAP_VISIBILITY_CHECK,
        { companies: [companyRef] },
        RPC_TIMEOUT,
      ),
      sendRpc<CompetitorListingRef[]>(
        this.integrationClient,
        Patterns.COMPETITOR_LISTINGS_FIND,
        { company: companyRef },
        RPC_TIMEOUT,
      ),
    ]);

    const ownYandexOrgId = this.findYandexSourceId(
      visibilityResults[0]?.byProvider?.yandex?.matchedItem?.sources,
    );

    const ownReviews = ownYandexOrgId
      ? await this.fetchYandexReviewTexts(company.id, ownYandexOrgId)
      : [];

    const competitorProfiles: Array<{
      name: string;
      hasPhone: boolean;
      category: string | undefined;
      rating: number | undefined;
      reviewCount: number | undefined;
      reviews: string[];
    }> = [];

    for (
      let i = 0;
      i < competitors.length;
      i += COMPETITOR_REVIEWS_CONCURRENCY
    ) {
      const batch = competitors.slice(i, i + COMPETITOR_REVIEWS_CONCURRENCY);
      const batchProfiles = await Promise.all(
        batch.map((c) => this.buildCompetitorProfile(c)),
      );
      competitorProfiles.push(...batchProfiles);
    }

    const own = {
      hasPhone: this.hasPhone(company.card.fields),
      category: this.mainCategoryName(company.card.fields),
      rating: company.rating ?? undefined,
      reviewCount: company.reviewCount,
    };

    const insights = await sendRpc<CompetitorInsights>(
      this.aiClient,
      Patterns.AI_COMPETITOR_ANALYSIS_GENERATE,
      { own, competitors: competitorProfiles, ownReviews },
      RPC_TIMEOUT,
    );

    return sendRpc<SavedCompetitorAnalysisReport>(
      this.coreClient,
      Patterns.COMPETITOR_ANALYSIS_SAVE,
      {
        companyId: company.id,
        brandId,
        userId,
        competitors,
        cardComparison: insights.cardComparison,
        ratingComparison: insights.ratingComparison,
        textAnalysis: insights.textAnalysis,
      },
      RPC_TIMEOUT,
    );
  }

  // GET /competitor-analysis/:companyId/latest — читает последний уже
  // сохранённый отчёт (core-service.CompetitorAnalysisReportService.getLatest,
  // RPC-паттерн был готов с коммита 1 плана, но не пробрасывался наружу HTTP).
  async getLatestReport(
    companyId: string,
    brandId: string,
    userId: string,
  ): Promise<CompetitorAnalysisReportDetails | null> {
    return sendRpc<CompetitorAnalysisReportDetails | null>(
      this.coreClient,
      Patterns.COMPETITOR_ANALYSIS_GET_LATEST,
      { companyId, brandId, userId },
      RPC_TIMEOUT,
    );
  }

  // Batch-генерация на весь Brand разом (см.
  // docs/refactor-plans/competitor-analysis-report.md, коммит 7) — листинг
  // компаний через уже существующий Patterns.COMPANY_LIST_FOR_VISIBILITY,
  // дальше generateForCompany на каждую батчами по BRAND_BATCH_CONCURRENCY.
  async generateForBrand(
    brandId: string,
    userId: string,
  ): Promise<BrandGenerationResult[]> {
    const companies = await sendRpc<CompanyForListing[]>(
      this.coreClient,
      Patterns.COMPANY_LIST_FOR_VISIBILITY,
      { brandId, userId },
      RPC_TIMEOUT,
    );

    const results: BrandGenerationResult[] = [];

    for (let i = 0; i < companies.length; i += BRAND_BATCH_CONCURRENCY) {
      const batch = companies.slice(i, i + BRAND_BATCH_CONCURRENCY);
      const batchResults = await Promise.all(
        batch.map((company) =>
          this.generateOneForBrand(company.id, brandId, userId),
        ),
      );
      results.push(...batchResults);
    }

    return results;
  }

  private async generateOneForBrand(
    companyId: string,
    brandId: string,
    userId: string,
  ): Promise<BrandGenerationResult> {
    try {
      const report = await this.generateForCompany(companyId, brandId, userId);
      return { companyId, success: true, report };
    } catch (err) {
      return {
        companyId,
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  // Оба провайдера скрапятся последовательно (не Promise.all) — каждый
  // поднимает отдельный headless Chromium в map-parser, а параллелизм между
  // конкурентами уже ограничен COMPETITOR_REVIEWS_CONCURRENCY. Последовательность
  // здесь держит пиковое число одновременных Chromium на уровне этого лимита,
  // не удваивая его на конкурента с обоими источниками (см.
  // docs/refactor-plans/competitor-2gis-reviews.md).
  private async buildCompetitorProfile(c: CompetitorListingRef) {
    const yandexOrgId = this.findYandexSourceId(c.sources);
    const twoGisBranchId = this.findTwoGisSourceId(c.sources);

    const yandexReviews = yandexOrgId
      ? await this.fetchYandexReviewTexts(
          `competitor:${yandexOrgId}`,
          yandexOrgId,
        )
      : [];
    const twoGisReviews = twoGisBranchId
      ? await this.fetchTwoGisReviewTexts(
          `competitor:${twoGisBranchId}`,
          twoGisBranchId,
        )
      : [];

    return {
      name: c.name,
      hasPhone: Boolean(c.phone),
      category: c.categories?.[0],
      rating: c.rating,
      reviewCount: c.reviewCount,
      reviews: [...yandexReviews, ...twoGisReviews],
    };
  }

  private findYandexSourceId(
    sources: PlaceSourceRef[] | undefined,
  ): string | undefined {
    return sources?.find((s) => s.provider === 'yandex')?.id;
  }

  private findTwoGisSourceId(
    sources: PlaceSourceRef[] | undefined,
  ): string | undefined {
    return sources?.find((s) => s.provider === '2gis')?.id;
  }

  private async fetchYandexReviewTexts(
    companyIdLabel: string,
    orgId: string,
  ): Promise<string[]> {
    const reviews = await this.reviewsFetcher.fetchYandexReviews(
      companyIdLabel,
      orgId,
    );
    return reviews
      .map((r) => r.text)
      .filter((text): text is string => Boolean(text));
  }

  private async fetchTwoGisReviewTexts(
    companyIdLabel: string,
    branchId: string,
  ): Promise<string[]> {
    const reviews = await this.reviewsFetcher.fetchTwoGisReviews(
      companyIdLabel,
      branchId,
    );
    return reviews
      .map((r) => r.text)
      .filter((text): text is string => Boolean(text));
  }

  private hasPhone(fields: Record<string, { default?: unknown }>): boolean {
    const phones = fields.phones?.default;
    return Array.isArray(phones) && phones.length > 0;
  }

  private mainCategoryName(
    fields: Record<string, { default?: unknown }>,
  ): string | undefined {
    const mainCategory = fields.mainCategory?.default as
      | { name?: string }
      | undefined;
    return mainCategory?.name;
  }
}

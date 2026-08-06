import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { Patterns } from '@geo/contracts';
import { sendRpc } from '../common/rpc';
import { CompetitorReviewsFetcherService } from './competitor-reviews-fetcher.service';

// Сеть/AI-звенья пайплайна (поиск конкурентов, MapVisibility-сопоставление) —
// внешние запросы к 2ГИС/Яндексу, может занять десятки секунд (тот же порядок,
// что и в company-visibility, см. VISIBILITY_CHECK_TIMEOUT там).
const RPC_TIMEOUT = 30000;

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
      ? await this.fetchReviewTexts(company.id, ownYandexOrgId)
      : [];

    const competitorProfiles = await Promise.all(
      competitors.map(async (c) => {
        const yandexOrgId = this.findYandexSourceId(c.sources);
        const reviews = yandexOrgId
          ? await this.fetchReviewTexts(
              `competitor:${yandexOrgId}`,
              yandexOrgId,
            )
          : [];

        return {
          name: c.name,
          hasPhone: Boolean(c.phone),
          category: c.categories?.[0],
          rating: c.rating,
          reviewCount: c.reviewCount,
          reviews,
        };
      }),
    );

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

  private findYandexSourceId(
    sources: PlaceSourceRef[] | undefined,
  ): string | undefined {
    return sources?.find((s) => s.provider === 'yandex')?.id;
  }

  private async fetchReviewTexts(
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

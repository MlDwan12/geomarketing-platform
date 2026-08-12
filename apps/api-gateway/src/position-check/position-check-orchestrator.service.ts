import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { Patterns } from '@geo/contracts';
import { sendRpc } from '../common/rpc';

// Поиск по обоим провайдерам на каждое ключевое слово (integration-service)
// может занять время — тот же порядок, что и в competitor-analysis/
// company-visibility для похожих внешних вызовов.
const RPC_TIMEOUT = 30000;

// Тот же принцип и то же число, что BRAND_BATCH_CONCURRENCY в
// CompetitorAnalysisOrchestratorService — сеть в 50 точек не должна улететь
// в rate limit 2ГИС/Яндекса разом. Здесь константа своя (не импортируется из
// competitor-analysis/) — между batch-фичами разных модулей нет общей
// зависимости на такие числа, только совпадение значения.
const BRAND_BATCH_CONCURRENCY = 5;

interface CompanyGetResult {
  id: string;
  name: string;
  coordinates: [number, number] | null;
  card: { fields: Record<string, { default?: unknown }> };
}

interface TrackedKeywordRef {
  keyword: string;
}

interface PositionCheckEntryRef {
  keyword: string;
  provider: '2gis' | 'yandex';
  position: number | null;
}

export interface SavedPositionCheckResult {
  id: string;
  companyId: string;
  keyword: string;
  source: 'auto' | 'manual';
  provider: '2gis' | 'yandex';
  position: number | null;
  checkedAt: string;
}

interface CompanyForListing {
  id: string;
}

export interface BrandPositionCheckResult {
  companyId: string;
  success: boolean;
  results?: SavedPositionCheckResult[];
  error?: string;
}

// Оркестрация проверки позиции на одну Company (см.
// docs/refactor-plans/position-checker.md, коммит 5) — собирает ключевые
// слова (авто из категории карточки + ручные из TrackedKeyword) → расчёт
// позиции (integration-service) → сохранение (core-service).
@Injectable()
export class PositionCheckOrchestratorService {
  constructor(
    @Inject('CORE_SERVICE') private readonly coreClient: ClientProxy,
    @Inject('INTEGRATION_SERVICE')
    private readonly integrationClient: ClientProxy,
  ) {}

  async checkPositions(
    companyId: string,
    brandId: string,
    userId: string,
  ): Promise<SavedPositionCheckResult[]> {
    const [company, manualKeywords] = await Promise.all([
      sendRpc<CompanyGetResult>(this.coreClient, Patterns.COMPANY_GET, {
        companyId,
        brandId,
        userId,
      }),
      sendRpc<TrackedKeywordRef[]>(
        this.coreClient,
        Patterns.POSITION_KEYWORDS_LIST,
        { companyId, brandId, userId },
      ),
    ]);

    // Map, не массив — если пользователь вручную добавил то же слово, что
    // уже является авто-категорией, оно проверяется один раз, не дважды
    // (авто побеждает при коллизии — не принципиально, какой источник
    // побеждает, важно не дублировать запрос).
    const keywordSources = new Map<string, 'auto' | 'manual'>();

    const autoKeyword = this.mainCategoryName(company.card.fields);
    if (autoKeyword) keywordSources.set(autoKeyword, 'auto');

    for (const { keyword } of manualKeywords) {
      if (!keywordSources.has(keyword)) keywordSources.set(keyword, 'manual');
    }

    const keywords = [...keywordSources.keys()];
    if (!keywords.length) return [];

    const found = await sendRpc<PositionCheckEntryRef[]>(
      this.integrationClient,
      Patterns.POSITION_CHECK_FIND,
      {
        company: {
          id: company.id,
          name: company.name,
          coordinates: company.coordinates,
        },
        keywords,
      },
      RPC_TIMEOUT,
    );

    const results = found.map((entry) => ({
      keyword: entry.keyword,
      provider: entry.provider,
      position: entry.position,
      source: keywordSources.get(entry.keyword) ?? 'manual',
    }));

    return sendRpc<SavedPositionCheckResult[]>(
      this.coreClient,
      Patterns.POSITION_CHECK_SAVE,
      { companyId, brandId, userId, results },
      RPC_TIMEOUT,
    );
  }

  // Batch-проверка на ВСЕ Company бренда разом (см.
  // docs/refactor-plans/position-checker-brand-batch.md, коммит 1) — список
  // компаний через уже существующий Patterns.COMPANY_LIST_FOR_VISIBILITY (тот
  // же паттерн, что CompetitorAnalysisOrchestratorService.generateForBrand),
  // дальше checkPositions() на каждую батчами по BRAND_BATCH_CONCURRENCY.
  async checkPositionsForBrand(
    brandId: string,
    userId: string,
  ): Promise<BrandPositionCheckResult[]> {
    const companies = await sendRpc<CompanyForListing[]>(
      this.coreClient,
      Patterns.COMPANY_LIST_FOR_VISIBILITY,
      { brandId, userId },
    );

    const results: BrandPositionCheckResult[] = [];

    for (let i = 0; i < companies.length; i += BRAND_BATCH_CONCURRENCY) {
      const batch = companies.slice(i, i + BRAND_BATCH_CONCURRENCY);
      const batchResults = await Promise.all(
        batch.map((company) =>
          this.checkOneForBrand(company.id, brandId, userId),
        ),
      );
      results.push(...batchResults);
    }

    return results;
  }

  private async checkOneForBrand(
    companyId: string,
    brandId: string,
    userId: string,
  ): Promise<BrandPositionCheckResult> {
    try {
      const results = await this.checkPositions(companyId, brandId, userId);
      return { companyId, success: true, results };
    } catch (err) {
      return {
        companyId,
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
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

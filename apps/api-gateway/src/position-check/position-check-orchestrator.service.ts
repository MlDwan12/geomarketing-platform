import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { Patterns } from '@geo/contracts';
import { sendRpc } from '../common/rpc';

// Поиск по обоим провайдерам на каждое ключевое слово (integration-service)
// может занять время — тот же порядок, что и в competitor-analysis/
// company-visibility для похожих внешних вызовов.
const RPC_TIMEOUT = 30000;

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

  private mainCategoryName(
    fields: Record<string, { default?: unknown }>,
  ): string | undefined {
    const mainCategory = fields.mainCategory?.default as
      | { name?: string }
      | undefined;
    return mainCategory?.name;
  }
}

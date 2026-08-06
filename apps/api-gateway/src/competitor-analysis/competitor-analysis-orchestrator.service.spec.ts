import { of } from 'rxjs';
import { ClientProxy } from '@nestjs/microservices';
import { Patterns } from '@geo/contracts';
import { CompetitorAnalysisOrchestratorService } from './competitor-analysis-orchestrator.service';
import { CompetitorReviewsFetcherService } from './competitor-reviews-fetcher.service';

function fakeClient(responses: Record<string, unknown>) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const send = jest.fn((pattern: string, _payload: unknown) =>
    of(responses[pattern]),
  );
  return { client: { send } as unknown as ClientProxy, send };
}

function fakeReviewsFetcher(
  byOrgId: Record<string, { text: string | null; stars: number | null }[]>,
) {
  const fetchYandexReviews = jest
    .fn()
    .mockImplementation((_label: string, orgId: string) =>
      Promise.resolve(byOrgId[orgId] ?? []),
    );
  return {
    service: {
      fetchYandexReviews,
    } as unknown as CompetitorReviewsFetcherService,
    fetchYandexReviews,
  };
}

const companyGetResult = {
  id: 'company-1',
  name: 'Моё Кафе',
  coordinates: [37.6, 55.75] as [number, number],
  rating: 4.5,
  reviewCount: 10,
  card: {
    fields: {
      phones: { default: [{ value: '+7 999 000-00-00' }] },
      mainCategory: { default: { id: 'r1', name: 'Кафе' } },
    },
  },
};

const competitorListing = {
  name: 'Кафе Соседнее',
  phone: undefined,
  categories: ['Кафе'],
  rating: 4.0,
  reviewCount: 30,
  sources: [{ provider: 'yandex' as const, id: 'yandex-org-2', raw: {} }],
};

describe('CompetitorAnalysisOrchestratorService.generateForCompany', () => {
  it('собирает данные из всех сервисов и сохраняет отчёт', async () => {
    const core = fakeClient({
      [Patterns.COMPANY_GET]: companyGetResult,
      [Patterns.COMPETITOR_ANALYSIS_SAVE]: { id: 'report-1' },
    });
    const integration = fakeClient({
      [Patterns.MAP_VISIBILITY_CHECK]: [
        {
          companyId: 'company-1',
          byProvider: {
            yandex: {
              matchedItem: {
                sources: [
                  { provider: 'yandex', id: 'yandex-org-own', raw: {} },
                ],
              },
            },
          },
        },
      ],
      [Patterns.COMPETITOR_LISTINGS_FIND]: [competitorListing],
    });
    const ai = fakeClient({
      [Patterns.AI_COMPETITOR_ANALYSIS_GENERATE]: {
        cardComparison: { own: { hasPhone: true }, competitors: [] },
        ratingComparison: { own: { rating: 4.5 }, competitors: [] },
        textAnalysis: null,
      },
    });
    const reviews = fakeReviewsFetcher({
      'yandex-org-own': [{ text: 'Отлично', stars: 5 }],
      'yandex-org-2': [{ text: 'Так себе', stars: 3 }],
    });

    const orchestrator = new CompetitorAnalysisOrchestratorService(
      core.client,
      integration.client,
      ai.client,
      reviews.service,
    );

    const result = await orchestrator.generateForCompany(
      'company-1',
      'brand-1',
      'user-1',
    );

    expect(result).toEqual({ id: 'report-1' });

    // Своя карточка: hasPhone из card.fields.phones.default (непустой массив).
    const aiCall = ai.send.mock.calls[0][1] as {
      own: { hasPhone: boolean; category?: string; rating?: number };
      competitors: { name: string; reviews: string[] }[];
      ownReviews: string[];
    };
    expect(aiCall.own).toEqual({
      hasPhone: true,
      category: 'Кафе',
      rating: 4.5,
      reviewCount: 10,
    });
    expect(aiCall.ownReviews).toEqual(['Отлично']);
    expect(aiCall.competitors).toEqual([
      {
        name: 'Кафе Соседнее',
        hasPhone: false,
        category: 'Кафе',
        rating: 4.0,
        reviewCount: 30,
        reviews: ['Так себе'],
      },
    ]);

    // Сохранение — сырые CompetitorListing, а не CompetitorProfile.
    const saveCall = core.send.mock.calls.find(
      (call) => call[0] === Patterns.COMPETITOR_ANALYSIS_SAVE,
    )?.[1] as { companyId: string; competitors: unknown[] };
    expect(saveCall.companyId).toBe('company-1');
    expect(saveCall.competitors).toEqual([competitorListing]);
  });

  it('нет собственного листинга на Яндексе — свои отзывы не скрапятся', async () => {
    const core = fakeClient({
      [Patterns.COMPANY_GET]: { ...companyGetResult, card: { fields: {} } },
      [Patterns.COMPETITOR_ANALYSIS_SAVE]: { id: 'report-2' },
    });
    const integration = fakeClient({
      [Patterns.MAP_VISIBILITY_CHECK]: [
        {
          companyId: 'company-1',
          byProvider: { yandex: { matchedItem: undefined } },
        },
      ],
      [Patterns.COMPETITOR_LISTINGS_FIND]: [],
    });
    const ai = fakeClient({
      [Patterns.AI_COMPETITOR_ANALYSIS_GENERATE]: {
        cardComparison: {},
        ratingComparison: {},
        textAnalysis: null,
      },
    });
    const reviews = fakeReviewsFetcher({});

    const orchestrator = new CompetitorAnalysisOrchestratorService(
      core.client,
      integration.client,
      ai.client,
      reviews.service,
    );

    await orchestrator.generateForCompany('company-1', 'brand-1', 'user-1');

    expect(reviews.fetchYandexReviews).not.toHaveBeenCalled();
    const aiCall = ai.send.mock.calls[0][1] as { own: { hasPhone: boolean } };
    expect(aiCall.own.hasPhone).toBe(false);
  });
});

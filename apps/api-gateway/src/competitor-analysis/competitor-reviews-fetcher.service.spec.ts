import { ConfigService } from '@nestjs/config';
import { CompetitorReviewsFetcherService } from './competitor-reviews-fetcher.service';

function fakeConfig(mapParserUrl?: string): ConfigService {
  return {
    get: () => mapParserUrl,
  } as unknown as ConfigService;
}

function mockFetchOnce(ok: boolean, body: unknown) {
  return jest.spyOn(global, 'fetch').mockResolvedValue({
    ok,
    json: () => Promise.resolve(body),
  } as Response);
}

describe('CompetitorReviewsFetcherService.fetchYandexReviews', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('вызывает POST /parser/reviews с orgId, лимитом и saveToDb: false', async () => {
    const fetchMock = mockFetchOnce(true, {
      reviews: [{ text: 'Отлично', stars: 5 }],
    });
    const service = new CompetitorReviewsFetcherService(
      fakeConfig('http://map-parser-test:3005'),
    );

    const result = await service.fetchYandexReviews('label-1', 'org-42');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://map-parser-test:3005/parser/reviews',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          companyId: 'label-1',
          orgId: 'org-42',
          limit: 50,
          saveToDb: false,
        }),
      }),
    );
    expect(result).toEqual([{ text: 'Отлично', stars: 5 }]);
  });

  it('map-parser вернул не ok — пустой массив, не бросает исключение', async () => {
    mockFetchOnce(false, {});
    const service = new CompetitorReviewsFetcherService(fakeConfig());

    const result = await service.fetchYandexReviews('label-1', 'org-42');

    expect(result).toEqual([]);
  });

  it('сетевая ошибка — пустой массив (partial success), не роняет вызывающий код', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('network boom'));
    const service = new CompetitorReviewsFetcherService(fakeConfig());

    await expect(
      service.fetchYandexReviews('label-1', 'org-42'),
    ).resolves.toEqual([]);
  });

  it('без MAP_PARSER_URL в конфиге — использует дефолт для docker-сети', async () => {
    const fetchMock = mockFetchOnce(true, { reviews: [] });
    const service = new CompetitorReviewsFetcherService(fakeConfig(undefined));

    await service.fetchYandexReviews('label-1', 'org-42');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://geo-map-parser:3005/parser/reviews',
      expect.anything(),
    );
  });
});

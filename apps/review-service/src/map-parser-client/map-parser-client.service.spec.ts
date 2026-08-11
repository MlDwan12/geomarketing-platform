import { ConfigService } from '@nestjs/config';
import { MapParserClientService } from './map-parser-client.service';

function fakeConfig(values: Record<string, string> = {}): ConfigService {
  return {
    get: (key: string) => values[key],
  } as unknown as ConfigService;
}

function mockFetchOnce(ok: boolean, body: unknown) {
  return jest.spyOn(global, 'fetch').mockResolvedValue({
    ok,
    status: ok ? 200 : 500,
    json: () => Promise.resolve(body),
  } as Response);
}

describe('MapParserClientService.refreshYandexReviews', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('вызывает POST /parser/reviews с orgId и saveToDb:true', async () => {
    const fetchMock = mockFetchOnce(true, { reviews: [{}, {}] });
    const service = new MapParserClientService(
      fakeConfig({
        MAP_PARSER_URL: 'http://map-parser-test:3005',
        MAP_PARSER_INTERNAL_TOKEN: 'test-token',
      }),
    );

    const result = await service.refreshYandexReviews('company-1', 'org-42');

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://map-parser-test:3005/parser/reviews');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['X-Internal-Token']).toBe(
      'test-token',
    );
    expect(init.body).toBe(
      JSON.stringify({
        companyId: 'company-1',
        orgId: 'org-42',
        saveToDb: true,
      }),
    );
    expect(result).toEqual({ success: true, reviewsCount: 2 });
  });

  it('map-parser вернул не ok — partial failure, не бросает исключение', async () => {
    mockFetchOnce(false, {});
    const service = new MapParserClientService(fakeConfig());

    const result = await service.refreshYandexReviews('company-1', 'org-42');

    expect(result).toEqual({
      success: false,
      reviewsCount: 0,
      error: 'HTTP 500',
    });
  });

  it('map-parser вернул error в теле (напр. капча) — partial failure', async () => {
    mockFetchOnce(true, { error: 'captcha detected' });
    const service = new MapParserClientService(fakeConfig());

    const result = await service.refreshYandexReviews('company-1', 'org-42');

    expect(result).toEqual({
      success: false,
      reviewsCount: 0,
      error: 'captcha detected',
    });
  });

  it('сетевая ошибка — partial failure, не роняет вызывающий код', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('network boom'));
    const service = new MapParserClientService(fakeConfig());

    await expect(
      service.refreshYandexReviews('company-1', 'org-42'),
    ).resolves.toEqual({
      success: false,
      reviewsCount: 0,
      error: 'network boom',
    });
  });
});

describe('MapParserClientService.refreshTwoGisReviews', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('строит city-agnostic URL 2gis.ru/geo/{branchId} и вызывает POST /parser/2gis/reviews', async () => {
    const fetchMock = mockFetchOnce(true, { reviews: [{}] });
    const service = new MapParserClientService(
      fakeConfig({ MAP_PARSER_URL: 'http://map-parser-test:3005' }),
    );

    const result = await service.refreshTwoGisReviews(
      'company-1',
      '70000001057432436',
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'http://map-parser-test:3005/parser/2gis/reviews',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          companyId: 'company-1',
          twoGisUrl: 'https://2gis.ru/geo/70000001057432436',
          branchId: '70000001057432436',
          saveToDb: true,
        }),
      }),
    );
    expect(result).toEqual({ success: true, reviewsCount: 1 });
  });
});

describe('MapParserClientService.getStoredReviews', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('читает GET /parser/reviews/:companyId', async () => {
    const fetchMock = mockFetchOnce(true, [{ id: 'r-1' }]);
    const service = new MapParserClientService(
      fakeConfig({ MAP_PARSER_URL: 'http://map-parser-test:3005' }),
    );

    const result = await service.getStoredReviews('company-1');

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://map-parser-test:3005/parser/reviews/company-1');
    expect(result).toEqual([{ id: 'r-1' }]);
  });

  it('map-parser недоступен — пустой список, не бросает исключение', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('network boom'));
    const service = new MapParserClientService(fakeConfig());

    await expect(service.getStoredReviews('company-1')).resolves.toEqual([]);
  });

  it('без MAP_PARSER_URL в конфиге — использует дефолт для docker-сети', async () => {
    const fetchMock = mockFetchOnce(true, []);
    const service = new MapParserClientService(fakeConfig());

    await service.getStoredReviews('company-1');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://geo-map-parser:3005/parser/reviews/company-1',
      expect.anything(),
    );
  });
});

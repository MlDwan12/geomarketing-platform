import { ConfigService } from '@nestjs/config';
import { RpcException } from '@nestjs/microservices';
import { YandexPlacesService } from './yandex-places.service';

function fakeConfig(apiKey = 'test-key'): ConfigService {
  return {
    getOrThrow: () => apiKey,
  } as unknown as ConfigService;
}

function mockFetchOnce(status: number, body: unknown) {
  return jest.spyOn(global, 'fetch').mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(JSON.stringify(body)),
  } as Response);
}

function calledUrl(fetchMock: jest.SpiedFunction<typeof fetch>): URL {
  return fetchMock.mock.calls[0][0] as URL;
}

describe('YandexPlacesService.searchPlaces', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('строит URL с обязательными параметрами (text, apikey, lang, type=biz) и дефолтом results', async () => {
    const fetchMock = mockFetchOnce(200, {
      properties: { ResponseMetaData: { SearchResponse: { found: 0 } } },
      features: [],
    });
    const service = new YandexPlacesService(fakeConfig('my-key'));

    await service.searchPlaces({ query: 'кафе' });

    const url = calledUrl(fetchMock);
    expect(url.searchParams.get('text')).toBe('кафе');
    expect(url.searchParams.get('apikey')).toBe('my-key');
    expect(url.searchParams.get('lang')).toBe('ru_RU');
    expect(url.searchParams.get('type')).toBe('biz');
    expect(url.searchParams.get('results')).toBe('10');
    expect(url.searchParams.has('ll')).toBe(false);
    expect(url.searchParams.has('spn')).toBe(false);
    expect(url.searchParams.has('skip')).toBe(false);
  });

  it('передаёт ll, spn, results и skip, если заданы', async () => {
    const fetchMock = mockFetchOnce(200, { features: [] });
    const service = new YandexPlacesService(fakeConfig());

    await service.searchPlaces({
      query: 'кафе',
      ll: '82.921663,55.030195',
      spn: '0.1,0.1',
      results: 50,
      skip: 10,
    });

    const url = calledUrl(fetchMock);
    expect(url.searchParams.get('ll')).toBe('82.921663,55.030195');
    expect(url.searchParams.get('spn')).toBe('0.1,0.1');
    expect(url.searchParams.get('results')).toBe('50');
    expect(url.searchParams.get('skip')).toBe('10');
  });

  it('передаёт заданный lang вместо дефолтного ru_RU', async () => {
    const fetchMock = mockFetchOnce(200, { features: [] });
    const service = new YandexPlacesService(fakeConfig());

    await service.searchPlaces({ query: 'кафе', lang: 'en_US' });

    expect(calledUrl(fetchMock).searchParams.get('lang')).toBe('en_US');
  });

  it('успешный ответ — возвращает features и total из ResponseMetaData.SearchResponse.found', async () => {
    mockFetchOnce(200, {
      properties: { ResponseMetaData: { SearchResponse: { found: 1 } } },
      features: [{ type: 'Feature', properties: { name: 'Кафе Солнышко' } }],
    });
    const service = new YandexPlacesService(fakeConfig());

    const result = await service.searchPlaces({ query: 'кафе' });

    expect(result).toEqual({
      items: [{ type: 'Feature', properties: { name: 'Кафе Солнышко' } }],
      total: 1,
    });
  });

  it('нет ResponseMetaData.found — total считается по длине features', async () => {
    mockFetchOnce(200, {
      features: [
        { type: 'Feature', properties: { name: 'A' } },
        { type: 'Feature', properties: { name: 'B' } },
      ],
    });
    const service = new YandexPlacesService(fakeConfig());

    const result = await service.searchPlaces({ query: 'кафе' });

    expect(result.total).toBe(2);
  });

  it('пустой ответ — возвращает { items: [], total: 0 }', async () => {
    mockFetchOnce(200, {});
    const service = new YandexPlacesService(fakeConfig());

    const result = await service.searchPlaces({ query: 'кафе' });

    expect(result).toEqual({ items: [], total: 0 });
  });

  it('ошибка API (403) — бросает RpcException с тем же статусом', async () => {
    mockFetchOnce(403, { message: 'Invalid key' });
    const service = new YandexPlacesService(fakeConfig());

    await expect(service.searchPlaces({ query: 'кафе' })).rejects.toThrow(
      RpcException,
    );
  });
});

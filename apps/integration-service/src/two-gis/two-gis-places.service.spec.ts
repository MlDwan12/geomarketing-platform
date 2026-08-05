import { ConfigService } from '@nestjs/config';
import { RpcException } from '@nestjs/microservices';
import { TwoGisPlacesService } from './two-gis-places.service';

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

describe('TwoGisPlacesService.searchPlaces', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('строит URL с обязательными параметрами (q, key, locale) и дефолтами пагинации', async () => {
    const fetchMock = mockFetchOnce(200, {
      meta: { code: 200 },
      result: { items: [], total: 0 },
    });
    const service = new TwoGisPlacesService(fakeConfig('my-key'));

    await service.searchPlaces({ query: 'кафе' });

    const url = calledUrl(fetchMock);
    expect(url.searchParams.get('q')).toBe('кафе');
    expect(url.searchParams.get('key')).toBe('my-key');
    expect(url.searchParams.get('locale')).toBe('ru_RU');
    expect(url.searchParams.get('page')).toBe('1');
    expect(url.searchParams.get('page_size')).toBe('10');
    expect(url.searchParams.has('location')).toBe(false);
    expect(url.searchParams.has('region_id')).toBe(false);
    expect(url.searchParams.has('fields')).toBe(false);
  });

  it('передаёт fields с префиксом "items." для каждого значения', async () => {
    const fetchMock = mockFetchOnce(200, {
      result: { items: [], total: 0 },
    });
    const service = new TwoGisPlacesService(fakeConfig());

    await service.searchPlaces({
      query: 'кафе',
      fields: ['point', 'contact_groups', 'reviews'],
    });

    const url = calledUrl(fetchMock);
    expect(url.searchParams.get('fields')).toBe(
      'items.point,items.contact_groups,items.reviews',
    );
  });

  it('передаёт location и regionId, если заданы', async () => {
    const fetchMock = mockFetchOnce(200, {
      result: { items: [], total: 0 },
    });
    const service = new TwoGisPlacesService(fakeConfig());

    await service.searchPlaces({
      query: 'кафе',
      location: '82.921663,55.030195',
      regionId: 123,
      page: 2,
      pageSize: 50,
    });

    const url = calledUrl(fetchMock);
    expect(url.searchParams.get('location')).toBe('82.921663,55.030195');
    expect(url.searchParams.get('region_id')).toBe('123');
    expect(url.searchParams.get('page')).toBe('2');
    expect(url.searchParams.get('page_size')).toBe('50');
  });

  it('успешный ответ — возвращает items и total из result', async () => {
    mockFetchOnce(200, {
      meta: { code: 200 },
      result: {
        items: [{ id: '1', name: 'Кафе Солнышко' }],
        total: 1,
      },
    });
    const service = new TwoGisPlacesService(fakeConfig());

    const result = await service.searchPlaces({ query: 'кафе' });

    expect(result).toEqual({
      items: [{ id: '1', name: 'Кафе Солнышко' }],
      total: 1,
    });
  });

  it('пустой result — возвращает { items: [], total: 0 }', async () => {
    mockFetchOnce(200, {});
    const service = new TwoGisPlacesService(fakeConfig());

    const result = await service.searchPlaces({ query: 'кафе' });

    expect(result).toEqual({ items: [], total: 0 });
  });

  it('ошибка API (403) — бросает RpcException с тем же статусом', async () => {
    mockFetchOnce(403, { meta: { code: 403 } });
    const service = new TwoGisPlacesService(fakeConfig());

    await expect(service.searchPlaces({ query: 'кафе' })).rejects.toThrow(
      RpcException,
    );
  });

  it('HTTP 200, но meta.code !== 200 (2ГИС отдаёт ошибку авторизации так) — бросает RpcException с сообщением из meta.error', async () => {
    mockFetchOnce(200, {
      meta: {
        code: 403,
        error: {
          message: 'Authorization error, incorrect key.',
          type: 'forbidden',
        },
      },
    });
    const service = new TwoGisPlacesService(fakeConfig());

    await expect(service.searchPlaces({ query: 'кафе' })).rejects.toMatchObject(
      {
        error: {
          status: 403,
          message: 'Authorization error, incorrect key.',
        },
      },
    );
  });
});

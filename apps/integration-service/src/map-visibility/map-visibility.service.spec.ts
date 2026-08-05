import { MapVisibilityService } from './map-visibility.service';
import { TwoGisPlacesService } from '../two-gis/two-gis-places.service';
import { YandexPlacesService } from '../yandex/yandex-places.service';

function fakeTwoGis(impl: () => Promise<unknown>) {
  const searchPlaces = jest.fn(impl);
  const service = { searchPlaces } as unknown as TwoGisPlacesService;
  return { service, searchPlaces };
}

function fakeYandex(impl: () => Promise<unknown>) {
  const searchPlaces = jest.fn(impl);
  const service = { searchPlaces } as unknown as YandexPlacesService;
  return { service, searchPlaces };
}

describe('MapVisibilityService.checkVisibility', () => {
  it('компания найдена на 2ГИС, не найдена на Яндексе', async () => {
    const twoGis = fakeTwoGis(() =>
      Promise.resolve({
        items: [
          { id: '1', name: 'Кафе Солнышко', point: { lat: 55.75, lon: 37.6 } },
        ],
        total: 1,
      }),
    );
    const yandex = fakeYandex(() => Promise.resolve({ items: [], total: 0 }));
    const service = new MapVisibilityService(twoGis.service, yandex.service);

    const [result] = await service.checkVisibility([
      { id: 'c1', name: 'Кафе Солнышко', coordinates: [37.6, 55.75] },
    ]);

    expect(result.companyId).toBe('c1');
    expect(result.byProvider['2gis'].visible).toBe(true);
    expect(result.byProvider['2gis'].confidence).toBe('high');
    expect(result.byProvider.yandex.visible).toBe(false);
    expect(result.byProvider.yandex.error).toBeUndefined();
  });

  it('поиск по 2ГИС упал (например, нет координат и нет location) — visible: false, error задан', async () => {
    const twoGis = fakeTwoGis(() => Promise.reject(new Error('2GIS boom')));
    const yandex = fakeYandex(() => Promise.resolve({ items: [], total: 0 }));
    const service = new MapVisibilityService(twoGis.service, yandex.service);

    const [result] = await service.checkVisibility([
      { id: 'c1', name: 'Кафе Солнышко' },
    ]);

    expect(result.byProvider['2gis']).toEqual({
      visible: false,
      error: '2GIS boom',
    });
  });

  it('передаёт location из coordinates компании в оба провайдера в их форматах', async () => {
    const twoGis = fakeTwoGis(() => Promise.resolve({ items: [], total: 0 }));
    const yandex = fakeYandex(() => Promise.resolve({ items: [], total: 0 }));
    const service = new MapVisibilityService(twoGis.service, yandex.service);

    await service.checkVisibility([
      { id: 'c1', name: 'Кафе Солнышко', coordinates: [37.6, 55.75] },
    ]);

    expect(twoGis.searchPlaces).toHaveBeenCalledWith(
      expect.objectContaining({
        query: 'Кафе Солнышко',
        location: '37.6,55.75',
      }),
    );
    expect(yandex.searchPlaces).toHaveBeenCalledWith(
      expect.objectContaining({ query: 'Кафе Солнышко', ll: '37.6,55.75' }),
    );
  });

  it('нет coordinates у компании — location не передаётся ни в один провайдер', async () => {
    const twoGis = fakeTwoGis(() => Promise.resolve({ items: [], total: 0 }));
    const yandex = fakeYandex(() => Promise.resolve({ items: [], total: 0 }));
    const service = new MapVisibilityService(twoGis.service, yandex.service);

    await service.checkVisibility([{ id: 'c1', name: 'Кафе Солнышко' }]);

    expect(twoGis.searchPlaces).toHaveBeenCalledWith(
      expect.objectContaining({ location: undefined }),
    );
    expect(yandex.searchPlaces).toHaveBeenCalledWith(
      expect.objectContaining({ ll: undefined }),
    );
  });

  it('несколько компаний — каждой возвращается свой результат по companyId', async () => {
    const twoGis = fakeTwoGis(() => Promise.resolve({ items: [], total: 0 }));
    const yandex = fakeYandex(() => Promise.resolve({ items: [], total: 0 }));
    const service = new MapVisibilityService(twoGis.service, yandex.service);

    const results = await service.checkVisibility([
      { id: 'c1', name: 'Кафе Солнышко' },
      { id: 'c2', name: 'Аптека 36.6' },
    ]);

    expect(results.map((r) => r.companyId)).toEqual(['c1', 'c2']);
  });
});

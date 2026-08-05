import { PlacesSearchService } from './places-search.service';
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

describe('PlacesSearchService.search', () => {
  it('оба провайдера успешны, дублей нет — объединяет результаты, failedSources пуст', async () => {
    const twoGis = fakeTwoGis(() =>
      Promise.resolve({
        items: [
          {
            id: '1',
            name: 'Кафе Солнышко',
            point: { lat: 55.75, lon: 37.6 },
          },
        ],
        total: 1,
      }),
    );
    const yandex = fakeYandex(() =>
      Promise.resolve({
        items: [
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [40.0, 60.0] },
            properties: {
              CompanyMetaData: { id: '2', name: 'Аптека 36.6' },
            },
          },
        ],
        total: 1,
      }),
    );
    const service = new PlacesSearchService(twoGis.service, yandex.service);

    const result = await service.search({ query: 'кафе' });

    expect(result.items).toHaveLength(2);
    expect(result.total).toBe(2);
    expect(result.failedSources).toEqual([]);
  });

  it('2ГИС упал — частичный успех, failedSources содержит 2gis, результаты Яндекса возвращаются', async () => {
    const twoGis = fakeTwoGis(() => Promise.reject(new Error('boom')));
    const yandex = fakeYandex(() =>
      Promise.resolve({
        items: [
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [40.0, 60.0] },
            properties: { CompanyMetaData: { id: '2', name: 'Аптека 36.6' } },
          },
        ],
        total: 1,
      }),
    );
    const service = new PlacesSearchService(twoGis.service, yandex.service);

    const result = await service.search({ query: 'кафе' });

    expect(result.failedSources).toEqual(['2gis']);
    expect(result.items).toHaveLength(1);
  });

  it('оба провайдера упали — пустой items, оба в failedSources', async () => {
    const twoGis = fakeTwoGis(() => Promise.reject(new Error('boom')));
    const yandex = fakeYandex(() => Promise.reject(new Error('boom')));
    const service = new PlacesSearchService(twoGis.service, yandex.service);

    const result = await service.search({ query: 'кафе' });

    expect(result.items).toEqual([]);
    expect(result.failedSources).toEqual(['2gis', 'yandex']);
  });

  it('передаёт query и location в оба провайдера в их собственных форматах', async () => {
    const twoGis = fakeTwoGis(() => Promise.resolve({ items: [], total: 0 }));
    const yandex = fakeYandex(() => Promise.resolve({ items: [], total: 0 }));
    const service = new PlacesSearchService(twoGis.service, yandex.service);

    await service.search({ query: 'кафе', location: '37.6,55.75' });

    expect(twoGis.searchPlaces).toHaveBeenCalledWith(
      expect.objectContaining({ query: 'кафе', location: '37.6,55.75' }),
    );
    expect(yandex.searchPlaces).toHaveBeenCalledWith(
      expect.objectContaining({ query: 'кафе', ll: '37.6,55.75' }),
    );
  });

  it('дублирующиеся организации из обоих провайдеров схлопываются в одну запись', async () => {
    const twoGis = fakeTwoGis(() =>
      Promise.resolve({
        items: [
          {
            id: '1',
            name: 'Кафе Солнышко',
            point: { lat: 55.75, lon: 37.6 },
          },
        ],
        total: 1,
      }),
    );
    const yandex = fakeYandex(() =>
      Promise.resolve({
        items: [
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [37.6001, 55.7501] },
            properties: {
              CompanyMetaData: { id: '2', name: 'Кафе Солнышко' },
            },
          },
        ],
        total: 1,
      }),
    );
    const service = new PlacesSearchService(twoGis.service, yandex.service);

    const result = await service.search({ query: 'кафе' });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].sources.map((s) => s.provider).sort()).toEqual([
      '2gis',
      'yandex',
    ]);
  });
});

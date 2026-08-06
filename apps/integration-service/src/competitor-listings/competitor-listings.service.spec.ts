import { CompetitorListingsService } from './competitor-listings.service';
import { TwoGisPlacesService } from '../two-gis/two-gis-places.service';
import { YandexPlacesService } from '../yandex/yandex-places.service';
import { CompanyRef } from '../map-visibility/visibility-match';

function fakeTwoGis(byQuery: Record<string, () => Promise<unknown>>) {
  const searchPlaces = jest.fn((params: { query: string }) =>
    (
      byQuery[params.query] ?? (() => Promise.resolve({ items: [], total: 0 }))
    )(),
  );
  return {
    service: { searchPlaces } as unknown as TwoGisPlacesService,
    searchPlaces,
  };
}

function fakeYandex(byQuery: Record<string, () => Promise<unknown>>) {
  const searchPlaces = jest.fn((params: { query: string }) =>
    (
      byQuery[params.query] ?? (() => Promise.resolve({ items: [], total: 0 }))
    )(),
  );
  return {
    service: { searchPlaces } as unknown as YandexPlacesService,
    searchPlaces,
  };
}

const company: CompanyRef = {
  id: 'company-1',
  name: 'Моё Кафе',
  coordinates: [37.6, 55.75],
};

describe('CompetitorListingsService.findCompetitors', () => {
  it('без координат Company — пустой результат, без сетевых вызовов', async () => {
    const twoGis = fakeTwoGis({});
    const yandex = fakeYandex({});
    const service = new CompetitorListingsService(
      twoGis.service,
      yandex.service,
    );

    const result = await service.findCompetitors({ id: 'c1', name: 'Х' });

    expect(result).toEqual([]);
    expect(twoGis.searchPlaces).not.toHaveBeenCalled();
    expect(yandex.searchPlaces).not.toHaveBeenCalled();
  });

  it('находит категорию своего листинга, ищет рядом и исключает саму компанию', async () => {
    const twoGis = fakeTwoGis({
      // Первый вызов findOwnListing — по имени компании.
      'Моё Кафе': () =>
        Promise.resolve({
          items: [
            {
              id: 'own-2gis',
              name: 'Моё Кафе',
              point: { lat: 55.75, lon: 37.6 },
              rubrics: [{ id: 'r1', name: 'Кафе' }],
            },
          ],
          total: 1,
        }),
      // Второй вызов — поиск конкурентов по категории "Кафе".
      Кафе: () =>
        Promise.resolve({
          items: [
            {
              id: 'own-2gis',
              name: 'Моё Кафе',
              point: { lat: 55.75, lon: 37.6 },
              rubrics: [{ id: 'r1', name: 'Кафе' }],
            },
            {
              id: 'comp-1',
              name: 'Кафе Соседнее',
              point: { lat: 55.7501, lon: 37.6005 },
              rubrics: [{ id: 'r1', name: 'Кафе' }],
              reviews: { general_rating: 4.1, general_review_count: 30 },
            },
          ],
          total: 2,
        }),
    });
    const yandex = fakeYandex({});
    const service = new CompetitorListingsService(
      twoGis.service,
      yandex.service,
    );

    const result = await service.findCompetitors(company);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      name: 'Кафе Соседнее',
      rating: 4.1,
      reviewCount: 30,
    });
  });

  it('нет собственного листинга на провайдере — конкуренты на нём не ищутся', async () => {
    const twoGis = fakeTwoGis({
      'Моё Кафе': () => Promise.resolve({ items: [], total: 0 }),
    });
    const yandex = fakeYandex({
      'Моё Кафе': () => Promise.resolve({ items: [], total: 0 }),
    });
    const service = new CompetitorListingsService(
      twoGis.service,
      yandex.service,
    );

    const result = await service.findCompetitors(company);

    expect(result).toEqual([]);
    // Только один вызов на провайдера — поиск собственного листинга;
    // поиск конкурентов не должен был запуститься без известной категории.
    expect(twoGis.searchPlaces).toHaveBeenCalledTimes(1);
    expect(yandex.searchPlaces).toHaveBeenCalledTimes(1);
  });

  it('провайдер упал (сеть/ключ) — не валит весь поиск, второй провайдер отдаёт результат', async () => {
    const twoGis = fakeTwoGis({
      'Моё Кафе': () => Promise.reject(new Error('2GIS boom')),
    });
    const yandex = fakeYandex({
      'Моё Кафе': () => Promise.resolve({ items: [], total: 0 }),
    });
    const service = new CompetitorListingsService(
      twoGis.service,
      yandex.service,
    );

    await expect(service.findCompetitors(company)).resolves.toEqual([]);
  });
});

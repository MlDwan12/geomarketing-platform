import { findPosition } from './position-check';
import { TwoGisPlacesService } from '../two-gis/two-gis-places.service';
import { YandexPlacesService } from '../yandex/yandex-places.service';
import { CompanyRef } from '../map-visibility/visibility-match';

function fakeTwoGis(items: unknown[]) {
  const searchPlaces = jest
    .fn()
    .mockResolvedValue({ items, total: items.length });
  return {
    service: { searchPlaces } as unknown as TwoGisPlacesService,
    searchPlaces,
  };
}

function fakeYandex(items: unknown[]) {
  const searchPlaces = jest
    .fn()
    .mockResolvedValue({ items, total: items.length });
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

function twoGisItem(id: string, name: string, lon: number, lat: number) {
  return { id, name, point: { lat, lon } };
}

function yandexFeature(id: string, name: string, lon: number, lat: number) {
  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [lon, lat] },
    properties: { name, CompanyMetaData: { id, name } },
  };
}

describe('findPosition (2gis)', () => {
  it('своя компания на первом месте — position 0', async () => {
    const twoGis = fakeTwoGis([
      twoGisItem('own', 'Моё Кафе', 37.6, 55.75),
      twoGisItem('other', 'Пивной бар №1', 37.601, 55.751),
    ]);
    const yandex = fakeYandex([]);

    const position = await findPosition(company, 'кафе', '2gis', {
      twoGis: twoGis.service,
      yandex: yandex.service,
    });

    expect(position).toBe(0);
    expect(twoGis.searchPlaces).toHaveBeenCalledWith({
      query: 'кафе',
      location: '37.6,55.75',
      pageSize: 10,
      fields: ['point'],
    });
  });

  it('своя компания на 5-й позиции — position 5', async () => {
    const others = Array.from({ length: 5 }, (_, i) =>
      twoGisItem(`other-${i}`, 'Пивной бар №1', 37.601, 55.751),
    );
    const twoGis = fakeTwoGis([
      ...others,
      twoGisItem('own', 'Моё Кафе', 37.6, 55.75),
    ]);
    const yandex = fakeYandex([]);

    const position = await findPosition(company, 'кафе', '2gis', {
      twoGis: twoGis.service,
      yandex: yandex.service,
    });

    expect(position).toBe(5);
  });

  it('не найдено в топ-10 — null', async () => {
    const twoGis = fakeTwoGis([
      twoGisItem('other', 'Пивной бар №1', 37.601, 55.751),
    ]);
    const yandex = fakeYandex([]);

    const position = await findPosition(company, 'кафе', '2gis', {
      twoGis: twoGis.service,
      yandex: yandex.service,
    });

    expect(position).toBeNull();
  });

  it('без координат у Company — null без сетевого запроса', async () => {
    const twoGis = fakeTwoGis([]);
    const yandex = fakeYandex([]);

    const position = await findPosition(
      { id: 'c1', name: 'Х' },
      'кафе',
      '2gis',
      { twoGis: twoGis.service, yandex: yandex.service },
    );

    expect(position).toBeNull();
    expect(twoGis.searchPlaces).not.toHaveBeenCalled();
  });
});

describe('findPosition (yandex)', () => {
  it('своя компания найдена — возвращает индекс совпадения, вызывает Yandex, не 2ГИС', async () => {
    const twoGis = fakeTwoGis([]);
    const yandex = fakeYandex([
      yandexFeature('other', 'Пивной бар №1', 37.601, 55.751),
      yandexFeature('own', 'Моё Кафе', 37.6, 55.75),
    ]);

    const position = await findPosition(company, 'кафе', 'yandex', {
      twoGis: twoGis.service,
      yandex: yandex.service,
    });

    expect(position).toBe(1);
    expect(twoGis.searchPlaces).not.toHaveBeenCalled();
    expect(yandex.searchPlaces).toHaveBeenCalledWith({
      query: 'кафе',
      ll: '37.6,55.75',
      results: 10,
    });
  });
});

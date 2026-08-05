import {
  dedupePlaces,
  normalizeTwoGisItem,
  normalizeYandexItem,
  NormalizedPlace,
} from './normalize';
import type { TwoGisPlaceItem } from '../two-gis/two-gis-places.service';
import type { YandexOrgFeature } from '../yandex/yandex-places.service';

describe('normalizeTwoGisItem', () => {
  it('вытаскивает name/address/phone/coordinates/categories из формы 2ГИС', () => {
    const item: TwoGisPlaceItem = {
      id: '1',
      name: 'Кафе Солнышко',
      full_address_name: 'Москва, ул. Ленина, 1',
      point: { lat: 55.75, lon: 37.6 },
      rubrics: [{ id: 'r1', name: 'Кафе' }],
      contact_groups: [
        { contacts: [{ type: 'phone', value: '+7 999 000-00-00' }] },
      ],
    };

    expect(normalizeTwoGisItem(item)).toEqual({
      name: 'Кафе Солнышко',
      address: 'Москва, ул. Ленина, 1',
      phone: '+7 999 000-00-00',
      coordinates: [37.6, 55.75],
      categories: ['Кафе'],
      sources: [{ provider: '2gis', id: '1', raw: item }],
    });
  });

  it('address_name как фолбэк, если нет full_address_name', () => {
    const item: TwoGisPlaceItem = { id: '1', address_name: 'Короткий адрес' };
    expect(normalizeTwoGisItem(item).address).toBe('Короткий адрес');
  });
});

describe('normalizeYandexItem', () => {
  it('вытаскивает поля из CompanyMetaData', () => {
    const feature: YandexOrgFeature = {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [37.6, 55.75] },
      properties: {
        name: 'Кафе Пушкинъ',
        CompanyMetaData: {
          id: '123',
          name: 'Кафе Пушкинъ',
          address: 'Москва, Тверской бульвар, 26А',
          Phones: [{ type: 'phone', formatted: '+7 (495) 739-00-33' }],
          Categories: [{ class: 'cafe', name: 'Кафе' }],
        },
      },
    };

    expect(normalizeYandexItem(feature)).toEqual({
      name: 'Кафе Пушкинъ',
      address: 'Москва, Тверской бульвар, 26А',
      phone: '+7 (495) 739-00-33',
      coordinates: [37.6, 55.75],
      categories: ['Кафе'],
      sources: [{ provider: 'yandex', id: '123', raw: feature }],
    });
  });

  it('name как фолбэк, если нет CompanyMetaData.name', () => {
    const feature: YandexOrgFeature = {
      type: 'Feature',
      properties: { name: 'Только properties.name' },
    };
    expect(normalizeYandexItem(feature).name).toBe('Только properties.name');
  });
});

function place(overrides: Partial<NormalizedPlace>): NormalizedPlace {
  return {
    name: 'Кафе Солнышко',
    coordinates: [37.6, 55.75],
    sources: [{ provider: '2gis', id: '1', raw: {} }],
    ...overrides,
  };
}

describe('dedupePlaces', () => {
  it('одинаковое название и близкие координаты (2ГИС + Яндекс) — мержит в одну запись с двумя sources', () => {
    const a = place({
      name: 'Кафе Солнышко',
      coordinates: [37.6, 55.75],
      sources: [{ provider: '2gis', id: '1', raw: {} }],
    });
    const b = place({
      name: 'Кафе Солнышко',
      coordinates: [37.6001, 55.7501], // ~15м от a
      sources: [{ provider: 'yandex', id: '2', raw: {} }],
    });

    const result = dedupePlaces([a, b]);

    expect(result).toHaveLength(1);
    expect(result[0].sources).toEqual([
      { provider: '2gis', id: '1', raw: {} },
      { provider: 'yandex', id: '2', raw: {} },
    ]);
  });

  it('похожие названия с опечаткой всё равно мержатся при близких координатах (разные провайдеры)', () => {
    const a = place({
      name: 'Кафе Солнышко',
      coordinates: [37.6, 55.75],
      sources: [{ provider: '2gis', id: '1', raw: {} }],
    });
    const b = place({
      name: 'Кафе Солнышк',
      coordinates: [37.6001, 55.7501],
      sources: [{ provider: 'yandex', id: '2', raw: {} }],
    });

    expect(dedupePlaces([a, b])).toHaveLength(1);
  });

  it('2ГИС дописывает категорию в name ("Кафе Пушкинъ, ресторан русской кухни") — всё равно мержится по префиксу с чистым названием от Яндекса (проверено живым запросом)', () => {
    const a = place({
      name: 'Кафе Пушкинъ, ресторан русской кухни',
      coordinates: [37.605129, 55.763711],
      sources: [{ provider: '2gis', id: '1', raw: {} }],
    });
    const b = place({
      name: 'Кафе Пушкинъ',
      coordinates: [37.60493, 55.763722],
      sources: [{ provider: 'yandex', id: '2', raw: {} }],
    });

    expect(dedupePlaces([a, b])).toHaveLength(1);
  });

  it('далёкие координаты (>150м) — не мержит, даже если название совпадает и провайдеры разные', () => {
    const a = place({
      name: 'Кафе Солнышко',
      coordinates: [37.6, 55.75],
      sources: [{ provider: '2gis', id: '1', raw: {} }],
    });
    const b = place({
      name: 'Кафе Солнышко',
      coordinates: [37.61, 55.76], // далеко
      sources: [{ provider: 'yandex', id: '2', raw: {} }],
    });

    expect(dedupePlaces([a, b])).toHaveLength(2);
  });

  it('близкие координаты, но разные названия — не мержит (разные организации по соседству)', () => {
    const a = place({
      name: 'Кафе Солнышко',
      coordinates: [37.6, 55.75],
      sources: [{ provider: '2gis', id: '1', raw: {} }],
    });
    const b = place({
      name: 'Аптека 36.6',
      coordinates: [37.6001, 55.7501],
      sources: [{ provider: 'yandex', id: '2', raw: {} }],
    });

    expect(dedupePlaces([a, b])).toHaveLength(2);
  });

  it('нет координат хотя бы у одной записи — не мержит', () => {
    const a = place({
      name: 'Кафе Солнышко',
      coordinates: [37.6, 55.75],
      sources: [{ provider: '2gis', id: '1', raw: {} }],
    });
    const b = place({
      name: 'Кафе Солнышко',
      coordinates: undefined,
      sources: [{ provider: 'yandex', id: '2', raw: {} }],
    });

    expect(dedupePlaces([a, b])).toHaveLength(2);
  });

  it('нет дублей вообще — возвращает все записи как есть', () => {
    const a = place({ name: 'Кафе Солнышко', coordinates: [37.6, 55.75] });
    const b = place({ name: 'Аптека 36.6', coordinates: [40.0, 60.0] });

    expect(dedupePlaces([a, b])).toHaveLength(2);
  });

  it('телефоны совпадают (в разных форматах, 8.../+7...) — мержит', () => {
    const a = place({
      name: 'Кафе Солнышко',
      coordinates: [37.6, 55.75],
      phone: '+7 999 000-00-00',
      sources: [{ provider: '2gis', id: '1', raw: {} }],
    });
    const b = place({
      name: 'Кафе Солнышко',
      coordinates: [37.6001, 55.7501],
      phone: '8 (999) 000-00-00',
      sources: [{ provider: 'yandex', id: '2', raw: {} }],
    });

    expect(dedupePlaces([a, b])).toHaveLength(1);
  });

  it('телефоны заданы у обеих записей, но разные — не мержит, даже при похожем названии и близких координатах', () => {
    const a = place({
      name: 'Кафе Солнышко',
      coordinates: [37.6, 55.75],
      phone: '+7 999 000-00-00',
      sources: [{ provider: '2gis', id: '1', raw: {} }],
    });
    const b = place({
      name: 'Кафе Солнышко',
      coordinates: [37.6001, 55.7501],
      phone: '+7 999 111-11-11',
      sources: [{ provider: 'yandex', id: '2', raw: {} }],
    });

    expect(dedupePlaces([a, b])).toHaveLength(2);
  });

  it('телефон есть только у одной записи — не блокирует мёрдж (нет сигнала для проверки)', () => {
    const a = place({
      name: 'Кафе Солнышко',
      coordinates: [37.6, 55.75],
      phone: '+7 999 000-00-00',
      sources: [{ provider: '2gis', id: '1', raw: {} }],
    });
    const b = place({
      name: 'Кафе Солнышко',
      coordinates: [37.6001, 55.7501],
      sources: [{ provider: 'yandex', id: '2', raw: {} }],
    });

    expect(dedupePlaces([a, b])).toHaveLength(1);
  });

  it('одинаковый провайдер, похожее название и близкие координаты — НЕ мержит (вероятно разные соседние филиалы одной сети, проверено живым запросом)', () => {
    const a = place({
      name: 'Кафе Пушкинъ',
      coordinates: [37.6, 55.75],
      sources: [{ provider: 'yandex', id: '1', raw: {} }],
    });
    const b = place({
      name: 'Кафе Пушкинъ',
      coordinates: [37.6001, 55.7501],
      sources: [{ provider: 'yandex', id: '2', raw: {} }],
    });

    expect(dedupePlaces([a, b])).toHaveLength(2);
  });
});

import { matchesCompany } from './visibility-match';
import { NormalizedPlace } from '../places-search/normalize';

function candidate(overrides: Partial<NormalizedPlace>): NormalizedPlace {
  return {
    name: 'Кафе Солнышко',
    sources: [{ provider: '2gis', id: '1', raw: {} }],
    ...overrides,
  };
}

describe('matchesCompany', () => {
  it('координаты есть у обеих сторон, близко и похожее название — matched, confidence high', () => {
    const company = {
      id: 'c1',
      name: 'Кафе Солнышко',
      coordinates: [37.6, 55.75] as [number, number],
    };
    const result = matchesCompany(
      company,
      candidate({ coordinates: [37.6001, 55.7501] }),
    );

    expect(result).toEqual({ matched: true, confidence: 'high' });
  });

  it('2ГИС дописывает категорию в name — всё равно matched по префиксу (проверено живым запросом)', () => {
    const company = {
      id: 'c1',
      name: 'Кафе Пушкинъ',
      coordinates: [37.60493, 55.763722] as [number, number],
    };
    const result = matchesCompany(
      company,
      candidate({
        name: 'Кафе Пушкинъ, ресторан русской кухни',
        coordinates: [37.605129, 55.763711],
      }),
    );

    expect(result).toEqual({ matched: true, confidence: 'high' });
  });

  it('координаты есть у обеих сторон, но далеко — не matched', () => {
    const company = {
      id: 'c1',
      name: 'Кафе Солнышко',
      coordinates: [37.6, 55.75] as [number, number],
    };
    const result = matchesCompany(
      company,
      candidate({ coordinates: [37.61, 55.76] }),
    );

    expect(result.matched).toBe(false);
  });

  it('координаты есть, но названия разные — не matched', () => {
    const company = {
      id: 'c1',
      name: 'Кафе Солнышко',
      coordinates: [37.6, 55.75] as [number, number],
    };
    const result = matchesCompany(
      company,
      candidate({ name: 'Аптека 36.6', coordinates: [37.6001, 55.7501] }),
    );

    expect(result.matched).toBe(false);
  });

  it('нет координат у Company — сопоставление только по тексту, confidence low', () => {
    const company = { id: 'c1', name: 'Кафе Солнышко' };
    const result = matchesCompany(
      company,
      candidate({ name: 'Кафе Солнышко' }),
    );

    expect(result).toEqual({ matched: true, confidence: 'low' });
  });

  it('нет координат, названия недостаточно похожи (ниже порога text-only) — не matched', () => {
    const company = { id: 'c1', name: 'Кафе Солнышко' };
    const result = matchesCompany(
      company,
      candidate({ name: 'Кафе на районе' }),
    );

    expect(result.matched).toBe(false);
  });

  it('нет координат, название похоже, но адреса заданы и не совпадают — не matched', () => {
    const company = {
      id: 'c1',
      name: 'Кафе Солнышко',
      address: 'Москва, ул. Ленина, 1',
    };
    const result = matchesCompany(
      company,
      candidate({
        name: 'Кафе Солнышко',
        address: 'Санкт-Петербург, Невский проспект, 100',
      }),
    );

    expect(result.matched).toBe(false);
  });

  it('нет координат, название похоже, адрес у кандидата не задан — matched (нет сигнала для проверки адреса)', () => {
    const company = {
      id: 'c1',
      name: 'Кафе Солнышко',
      address: 'Москва, ул. Ленина, 1',
    };
    const result = matchesCompany(
      company,
      candidate({ name: 'Кафе Солнышко' }),
    );

    expect(result).toEqual({ matched: true, confidence: 'low' });
  });

  it('координаты у Company есть, а у кандидата нет — падает на текстовый фолбэк (low), а не отказ', () => {
    const company = {
      id: 'c1',
      name: 'Кафе Солнышко',
      coordinates: [37.6, 55.75] as [number, number],
    };
    const result = matchesCompany(
      company,
      candidate({ name: 'Кафе Солнышко', coordinates: undefined }),
    );

    expect(result).toEqual({ matched: true, confidence: 'low' });
  });
});

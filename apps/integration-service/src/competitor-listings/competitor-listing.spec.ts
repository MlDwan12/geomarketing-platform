import {
  COMPETITOR_RADIUS_METERS,
  filterByCategory,
  MAX_COMPETITORS,
  rankCompetitors,
} from './competitor-listing';
import { NormalizedPlace } from '../places-search/normalize';
import { CompanyRef } from '../map-visibility/visibility-match';

function place(overrides: Partial<NormalizedPlace>): NormalizedPlace {
  return {
    name: 'Кафе Х',
    coordinates: [37.6, 55.75],
    categories: ['Кафе'],
    sources: [{ provider: '2gis', id: '1', raw: {} }],
    ...overrides,
  };
}

describe('filterByCategory', () => {
  it('оставляет только кандидатов с похожей категорией', () => {
    const candidates = [
      place({ name: 'Кафе А', categories: ['Кафе'] }),
      place({ name: 'Аптека Б', categories: ['Аптека'] }),
    ];

    expect(filterByCategory(candidates, 'Кафе')).toEqual([candidates[0]]);
  });

  it('без категорий у кандидата — не проходит фильтр', () => {
    const candidates = [place({ categories: undefined })];
    expect(filterByCategory(candidates, 'Кафе')).toEqual([]);
  });
});

describe('rankCompetitors', () => {
  const company: CompanyRef = {
    id: 'company-1',
    name: 'Моё Кафе',
    coordinates: [37.6, 55.75],
  };

  it('без координат у Company — пустой результат', () => {
    const noCoordsCompany: CompanyRef = { id: 'c1', name: 'Х' };
    expect(rankCompetitors(noCoordsCompany, [place({})])).toEqual([]);
  });

  it('исключает саму компанию из результата', () => {
    const self = place({ name: 'Моё Кафе', coordinates: [37.6, 55.75] });
    expect(rankCompetitors(company, [self])).toEqual([]);
  });

  it('исключает кандидатов дальше радиуса', () => {
    // ~0.02 градуса по широте ≈ больше 1000м
    const far = place({
      name: 'Кафе далеко',
      coordinates: [37.6, 55.77],
    });
    expect(rankCompetitors(company, [far])).toEqual([]);
  });

  it('сортирует по расстоянию и ограничивает MAX_COMPETITORS', () => {
    const candidates = Array.from({ length: MAX_COMPETITORS + 2 }, (_, i) =>
      place({
        name: `Кафе ${i}`,
        // Каждый следующий чуть дальше предыдущего, все в радиусе.
        coordinates: [37.6 + i * 0.0005, 55.75],
      }),
    ).reverse(); // намеренно не по порядку на входе

    const result = rankCompetitors(company, candidates);

    expect(result).toHaveLength(MAX_COMPETITORS);
    expect(result[0].name).toBe('Кафе 0');
    expect(
      result.every((r) => r.distanceMeters <= COMPETITOR_RADIUS_METERS),
    ).toBe(true);
    for (let i = 1; i < result.length; i++) {
      expect(result[i].distanceMeters).toBeGreaterThanOrEqual(
        result[i - 1].distanceMeters,
      );
    }
  });

  it('без координат у кандидата — исключается', () => {
    expect(
      rankCompetitors(company, [place({ coordinates: undefined })]),
    ).toEqual([]);
  });
});

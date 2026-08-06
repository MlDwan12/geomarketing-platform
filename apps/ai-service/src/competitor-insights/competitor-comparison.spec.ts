import { compareCardFields, compareRatings } from './competitor-comparison';
import { CompetitorProfile, OwnCompanyProfile } from './types';

function competitor(overrides: Partial<CompetitorProfile>): CompetitorProfile {
  return {
    name: 'Конкурент',
    hasPhone: true,
    reviews: [],
    ...overrides,
  };
}

describe('compareCardFields', () => {
  it('переносит hasPhone своей компании и каждого конкурента как есть', () => {
    const own: OwnCompanyProfile = { hasPhone: false };
    const competitors = [
      competitor({ name: 'А', hasPhone: true }),
      competitor({ name: 'Б', hasPhone: false }),
    ];

    expect(compareCardFields(own, competitors)).toEqual({
      own: { hasPhone: false },
      competitors: [
        { name: 'А', hasPhone: true },
        { name: 'Б', hasPhone: false },
      ],
    });
  });
});

describe('compareRatings', () => {
  it('считает средний рейтинг конкурентов и позицию своей компании', () => {
    const own: OwnCompanyProfile = {
      hasPhone: true,
      rating: 4.5,
      reviewCount: 10,
    };
    const competitors = [
      competitor({ name: 'А', rating: 4.0, reviewCount: 20 }),
      competitor({ name: 'Б', rating: 4.8, reviewCount: 5 }),
    ];

    const result = compareRatings(own, competitors);

    expect(result.averageCompetitorRating).toBeCloseTo(4.4);
    // Рейтинги по убыванию: 4.8 (Б), 4.5 (own), 4.0 (А) — own на 2-м месте.
    expect(result.ownRank).toBe(2);
    expect(result.own).toEqual({ rating: 4.5, reviewCount: 10 });
  });

  it('у своей компании нет рейтинга — ownRank не определён', () => {
    const own: OwnCompanyProfile = { hasPhone: true };
    const competitors = [competitor({ rating: 4.0 })];

    expect(compareRatings(own, competitors).ownRank).toBeUndefined();
  });

  it('ни у одного конкурента нет рейтинга — averageCompetitorRating не определён', () => {
    const own: OwnCompanyProfile = { hasPhone: true, rating: 4.5 };
    const competitors = [competitor({ rating: undefined })];

    const result = compareRatings(own, competitors);

    expect(result.averageCompetitorRating).toBeUndefined();
    expect(result.ownRank).toBe(1);
  });

  it('нет конкурентов вообще — own заполнен, competitors пустой', () => {
    const own: OwnCompanyProfile = {
      hasPhone: true,
      rating: 4.5,
      reviewCount: 3,
    };

    const result = compareRatings(own, []);

    expect(result).toEqual({
      own: { rating: 4.5, reviewCount: 3 },
      competitors: [],
      ownRank: 1,
      averageCompetitorRating: undefined,
    });
  });
});

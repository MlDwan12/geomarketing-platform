import { computeAggregates } from './review-aggregates';
import { MapParserReview } from '../map-parser-client/map-parser-client.service';

function fakeReview(overrides: Partial<MapParserReview> = {}): MapParserReview {
  return {
    id: 'r-1',
    companyId: 'company-1',
    source: 'GIS',
    externalReviewId: 'ext-1',
    authorName: 'Иван',
    rating: 5,
    text: 'Отлично',
    publishedAt: '2026-01-01T00:00:00.000Z',
    answer: null,
    answerPublishedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('computeAggregates', () => {
  it('пустой список — все агрегаты нулевые, averageRating null', () => {
    const result = computeAggregates([]);

    expect(result).toEqual({
      combined: { total: 0, unanswered: 0, averageRating: null },
      yandex: { total: 0, unanswered: 0, averageRating: null },
      twogis: { total: 0, unanswered: 0, averageRating: null },
    });
  });

  it('все отзывы отвечены — unanswered 0', () => {
    const reviews = [
      fakeReview({ answer: 'Спасибо!' }),
      fakeReview({ id: 'r-2', answer: 'И вам спасибо' }),
    ];

    expect(computeAggregates(reviews).combined).toEqual({
      total: 2,
      unanswered: 0,
      averageRating: 5,
    });
  });

  it('часть отзывов без ответа — считает unanswered корректно', () => {
    const reviews = [
      fakeReview({ answer: 'Спасибо!' }),
      fakeReview({ id: 'r-2', answer: null }),
      fakeReview({ id: 'r-3', answer: null }),
    ];

    expect(computeAggregates(reviews).combined.unanswered).toBe(2);
  });

  it('разбивает агрегаты по источнику (yandex/twogis) отдельно от combined', () => {
    const reviews = [
      fakeReview({ source: 'YANDEX', rating: 4, answer: null }),
      fakeReview({ id: 'r-2', source: 'GIS', rating: 2, answer: 'Ответ' }),
    ];

    const result = computeAggregates(reviews);

    expect(result.yandex).toEqual({
      total: 1,
      unanswered: 1,
      averageRating: 4,
    });
    expect(result.twogis).toEqual({
      total: 1,
      unanswered: 0,
      averageRating: 2,
    });
    expect(result.combined).toEqual({
      total: 2,
      unanswered: 1,
      averageRating: 3,
    });
  });

  it('отзыв без rating не искажает averageRating', () => {
    const reviews = [
      fakeReview({ rating: 5 }),
      fakeReview({ id: 'r-2', rating: null }),
    ];

    expect(computeAggregates(reviews).combined.averageRating).toBe(5);
  });
});

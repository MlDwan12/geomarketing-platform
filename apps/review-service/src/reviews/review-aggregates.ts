import { MapParserReview } from '../map-parser-client/map-parser-client.service';

export type SourceAggregate = {
  total: number;
  unanswered: number;
  averageRating: number | null;
};

export type ReviewAggregates = {
  combined: SourceAggregate;
  yandex: SourceAggregate;
  twogis: SourceAggregate;
};

// «Отвечено» определяется по наличию answer у отзыва на самой платформе
// (то, что вернул скрапинг) — не отдельным полем состояния внутри системы.
function aggregate(reviews: MapParserReview[]): SourceAggregate {
  const unanswered = reviews.filter((r) => !r.answer).length;
  const rated = reviews.filter((r) => typeof r.rating === 'number');
  const averageRating = rated.length
    ? rated.reduce((sum, r) => sum + (r.rating ?? 0), 0) / rated.length
    : null;

  return { total: reviews.length, unanswered, averageRating };
}

export function computeAggregates(
  reviews: MapParserReview[],
): ReviewAggregates {
  const yandexReviews = reviews.filter((r) => r.source === 'YANDEX');
  const twogisReviews = reviews.filter((r) => r.source === 'GIS');

  return {
    combined: aggregate(reviews),
    yandex: aggregate(yandexReviews),
    twogis: aggregate(twogisReviews),
  };
}

import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { ReviewEntity } from './entities/review.entity';
import { YandexCompanyReview } from '../yandex-parser/yandex-parser.service';
import { TwoGisReview } from '../two-gis-parser/two-gis-parser.service';

// externalReviewId — обязательная колонка (часть unique-индекса upsert'а), без него
// сохранять нечего — отзыв без id платформы пропускается на уровне вызывающего кода
// (см. .filter в контроллере).
export function mapYandexReviewToEntity(
  companyId: string,
  review: YandexCompanyReview,
): QueryDeepPartialEntity<ReviewEntity> | null {
  if (!review.externalId) return null;

  return {
    companyId,
    source: 'YANDEX',
    externalReviewId: review.externalId,
    authorName: review.authorName ?? undefined,
    rating: review.stars,
    text: review.text ?? undefined,
    publishedAt: review.publishedAt
      ? new Date(review.publishedAt * 1000)
      : undefined,
    answer: review.answer ?? undefined,
    answerPublishedAt: review.answerPublishedAt
      ? new Date(review.answerPublishedAt * 1000)
      : undefined,
    raw: review,
  };
}

export function mapTwoGisReviewToEntity(
  companyId: string,
  review: TwoGisReview,
): QueryDeepPartialEntity<ReviewEntity> | null {
  if (!review.externalId) return null;

  return {
    companyId,
    source: 'GIS',
    externalReviewId: review.externalId,
    authorName: review.authorName ?? undefined,
    rating: review.stars ?? undefined,
    text: review.text ?? undefined,
    publishedAt: review.publishedAt ? new Date(review.publishedAt) : undefined,
    answer: review.answer ?? undefined,
    answerPublishedAt: review.answerPublishedAt
      ? new Date(review.answerPublishedAt)
      : undefined,
    raw: review,
  };
}

import { mapTwoGisReviewToEntity, mapYandexReviewToEntity } from './map-review';
import { YandexCompanyReview } from '../yandex-parser/yandex-parser.service';
import { TwoGisReview } from '../two-gis-parser/two-gis-parser.service';

function fakeYandexReview(
  overrides: Partial<YandexCompanyReview> = {},
): YandexCompanyReview {
  return {
    externalId: 'y-1',
    businessId: null,
    authorName: 'Иван',
    authorPublicId: null,
    authorAvatarUrl: null,
    authorProfessionLevel: null,
    publishedAt: 1700000000,
    text: 'Отличное место',
    textLanguage: 'ru',
    stars: 5,
    likes: 0,
    dislikes: 0,
    answer: null,
    answerPublishedAt: null,
    photos: [],
    videos: [],
    source: 'api',
    ...overrides,
  };
}

function fakeTwoGisReview(overrides: Partial<TwoGisReview> = {}): TwoGisReview {
  return {
    externalId: 'g-1',
    authorName: 'Мария',
    authorAvatarUrl: null,
    publishedAt: '2023-08-30T03:06:25.000Z',
    dateText: '30 августа 2023',
    text: 'Хорошее кафе',
    stars: 4,
    answer: null,
    answerPublishedAt: null,
    likesCount: 0,
    provider: '2gis',
    isHidden: false,
    isRated: true,
    hidingReason: null,
    source: 'api',
    ...overrides,
  };
}

describe('mapYandexReviewToEntity', () => {
  it('маппит отзыв с ответом владельца в ReviewEntity', () => {
    const review = fakeYandexReview({
      answer: 'Спасибо за отзыв!',
      answerPublishedAt: 1700100000,
    });

    const entity = mapYandexReviewToEntity('company-1', review);

    expect(entity).toMatchObject({
      companyId: 'company-1',
      source: 'YANDEX',
      externalReviewId: 'y-1',
      authorName: 'Иван',
      rating: 5,
      text: 'Отличное место',
      answer: 'Спасибо за отзыв!',
    });
    expect(entity?.publishedAt).toEqual(new Date(1700000000 * 1000));
    expect(entity?.answerPublishedAt).toEqual(new Date(1700100000 * 1000));
  });

  it('без externalId возвращает null — нечего сохранять без id платформы', () => {
    const review = fakeYandexReview({ externalId: null });

    expect(mapYandexReviewToEntity('company-1', review)).toBeNull();
  });

  it('без ответа владельца answer/answerPublishedAt остаются undefined', () => {
    const review = fakeYandexReview();

    const entity = mapYandexReviewToEntity('company-1', review);

    expect(entity?.answer).toBeUndefined();
    expect(entity?.answerPublishedAt).toBeUndefined();
  });
});

describe('mapTwoGisReviewToEntity', () => {
  it('маппит отзыв с ответом владельца в ReviewEntity', () => {
    const review = fakeTwoGisReview({
      answer: 'Заходите ещё!',
      answerPublishedAt: '2023-09-01T10:00:00.000Z',
    });

    const entity = mapTwoGisReviewToEntity('company-1', review);

    expect(entity).toMatchObject({
      companyId: 'company-1',
      source: 'GIS',
      externalReviewId: 'g-1',
      authorName: 'Мария',
      rating: 4,
      text: 'Хорошее кафе',
      answer: 'Заходите ещё!',
    });
    expect(entity?.publishedAt).toEqual(new Date('2023-08-30T03:06:25.000Z'));
    expect(entity?.answerPublishedAt).toEqual(
      new Date('2023-09-01T10:00:00.000Z'),
    );
  });

  it('без externalId возвращает null — нечего сохранять без id платформы', () => {
    const review = fakeTwoGisReview({ externalId: null });

    expect(mapTwoGisReviewToEntity('company-1', review)).toBeNull();
  });
});

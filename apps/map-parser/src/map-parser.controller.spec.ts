import { MapParserController } from './map-parser.controller';
import {
  YandexParserService,
  YandexParserResult,
} from './yandex-parser/yandex-parser.service';
import { MapParserService } from './map-parser.service';
import {
  TwoGisParserService,
  TwoGisParserResult,
} from './two-gis-parser/two-gis-parser.service';

function fakeYandexResult(
  overrides: Partial<YandexParserResult> = {},
): YandexParserResult {
  return {
    companyId: 'company-1',
    orgId: 'org-1',
    yandexUrl: 'https://yandex.com/maps/org/org/org-1/reviews/',
    reviews: [
      {
        externalId: 'y-1',
        businessId: null,
        authorName: 'Иван',
        authorPublicId: null,
        authorAvatarUrl: null,
        authorProfessionLevel: null,
        publishedAt: 1700000000,
        text: 'Отлично',
        textLanguage: 'ru',
        stars: 5,
        likes: 0,
        dislikes: 0,
        answer: null,
        answerPublishedAt: null,
        photos: [],
        videos: [],
        source: 'api',
      },
    ],
    ...overrides,
  };
}

function fakeTwoGisResult(
  overrides: Partial<TwoGisParserResult> = {},
): TwoGisParserResult {
  return {
    companyId: 'company-1',
    twoGisUrl: 'https://2gis.ru/geo/70000001057432436',
    branchRating: 4.7,
    branchReviewsCount: 6,
    totalCount: 6,
    parsed: 1,
    reviews: [
      {
        externalId: 'g-1',
        authorName: 'Мария',
        authorAvatarUrl: null,
        publishedAt: '2023-08-30T03:06:25.000Z',
        dateText: '30 августа 2023',
        text: 'Хорошо',
        stars: 4,
        answer: null,
        answerPublishedAt: null,
        likesCount: 0,
        provider: '2gis',
        isHidden: false,
        isRated: true,
        hidingReason: null,
        source: 'api',
      },
    ],
    ...overrides,
  };
}

describe('MapParserController', () => {
  describe('parseReviews (Яндекс)', () => {
    it('saveToDb=false (дефолт) не вызывает upsertReviews', async () => {
      const upsertReviews = jest.fn();
      const controller = new MapParserController(
        {
          parseReviews: jest.fn().mockResolvedValue(fakeYandexResult()),
        } as unknown as YandexParserService,
        {
          upsertReviews,
          findByCompany: jest.fn(),
        } as unknown as MapParserService,
        {} as TwoGisParserService,
      );

      await controller.parseReviews({ companyId: 'company-1', orgId: 'org-1' });

      expect(upsertReviews).not.toHaveBeenCalled();
    });

    it('saveToDb=true вызывает upsertReviews с замапленными отзывами', async () => {
      const upsertReviews = jest.fn();
      const controller = new MapParserController(
        {
          parseReviews: jest.fn().mockResolvedValue(fakeYandexResult()),
        } as unknown as YandexParserService,
        {
          upsertReviews,
          findByCompany: jest.fn(),
        } as unknown as MapParserService,
        {} as TwoGisParserService,
      );

      await controller.parseReviews({
        companyId: 'company-1',
        orgId: 'org-1',
        saveToDb: true,
      });

      expect(upsertReviews).toHaveBeenCalledWith([
        expect.objectContaining({
          companyId: 'company-1',
          source: 'YANDEX',
          externalReviewId: 'y-1',
        }),
      ]);
    });

    it('saveToDb=true с пустым списком отзывов не вызывает upsertReviews', async () => {
      const upsertReviews = jest.fn();
      const controller = new MapParserController(
        {
          parseReviews: jest
            .fn()
            .mockResolvedValue(fakeYandexResult({ reviews: [] })),
        } as unknown as YandexParserService,
        {
          upsertReviews,
          findByCompany: jest.fn(),
        } as unknown as MapParserService,
        {} as TwoGisParserService,
      );

      await controller.parseReviews({
        companyId: 'company-1',
        orgId: 'org-1',
        saveToDb: true,
      });

      expect(upsertReviews).not.toHaveBeenCalled();
    });
  });

  describe('parseTwoGisReviews (2ГИС)', () => {
    it('saveToDb=false (дефолт) не вызывает upsertReviews', async () => {
      const upsertReviews = jest.fn();
      const controller = new MapParserController(
        {} as YandexParserService,
        {
          upsertReviews,
          findByCompany: jest.fn(),
        } as unknown as MapParserService,
        {
          parseReviews: jest.fn().mockResolvedValue(fakeTwoGisResult()),
        } as unknown as TwoGisParserService,
      );

      await controller.parseTwoGisReviews({
        companyId: 'company-1',
        twoGisUrl: 'https://2gis.ru/geo/70000001057432436',
      });

      expect(upsertReviews).not.toHaveBeenCalled();
    });

    it('saveToDb=true вызывает upsertReviews с замапленными отзывами', async () => {
      const upsertReviews = jest.fn();
      const controller = new MapParserController(
        {} as YandexParserService,
        {
          upsertReviews,
          findByCompany: jest.fn(),
        } as unknown as MapParserService,
        {
          parseReviews: jest.fn().mockResolvedValue(fakeTwoGisResult()),
        } as unknown as TwoGisParserService,
      );

      await controller.parseTwoGisReviews({
        companyId: 'company-1',
        twoGisUrl: 'https://2gis.ru/geo/70000001057432436',
        saveToDb: true,
      });

      expect(upsertReviews).toHaveBeenCalledWith([
        expect.objectContaining({
          companyId: 'company-1',
          source: 'GIS',
          externalReviewId: 'g-1',
        }),
      ]);
    });
  });

  describe('getReviews', () => {
    it('читает сохранённые отзывы компании через MapParserService', async () => {
      const findByCompany = jest.fn().mockResolvedValue([{ id: 'r-1' }]);
      const controller = new MapParserController(
        {} as YandexParserService,
        {
          upsertReviews: jest.fn(),
          findByCompany,
        } as unknown as MapParserService,
        {} as TwoGisParserService,
      );

      const result = await controller.getReviews('company-1');

      expect(findByCompany).toHaveBeenCalledWith('company-1');
      expect(result).toEqual([{ id: 'r-1' }]);
    });
  });
});

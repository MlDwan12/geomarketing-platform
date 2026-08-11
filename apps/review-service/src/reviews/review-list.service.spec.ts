import { ReviewListService } from './review-list.service';
import { MapParserClientService } from '../map-parser-client/map-parser-client.service';

describe('ReviewListService.listForCompany', () => {
  it('читает отзывы через MapParserClientService и считает агрегаты', async () => {
    const getStoredReviews = jest.fn().mockResolvedValue([
      {
        id: 'r-1',
        companyId: 'company-1',
        source: 'GIS',
        externalReviewId: 'ext-1',
        rating: 5,
        answer: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ]);
    const service = new ReviewListService({
      getStoredReviews,
    } as unknown as MapParserClientService);

    const result = await service.listForCompany('company-1');

    expect(getStoredReviews).toHaveBeenCalledWith('company-1');
    expect(result.reviews).toHaveLength(1);
    expect(result.aggregates.combined).toEqual({
      total: 1,
      unanswered: 1,
      averageRating: 5,
    });
  });

  it('map-parser недоступен (пустой список) — агрегаты нулевые, не бросает исключение', async () => {
    const getStoredReviews = jest.fn().mockResolvedValue([]);
    const service = new ReviewListService({
      getStoredReviews,
    } as unknown as MapParserClientService);

    const result = await service.listForCompany('company-1');

    expect(result).toEqual({
      reviews: [],
      aggregates: {
        combined: { total: 0, unanswered: 0, averageRating: null },
        yandex: { total: 0, unanswered: 0, averageRating: null },
        twogis: { total: 0, unanswered: 0, averageRating: null },
      },
    });
  });
});

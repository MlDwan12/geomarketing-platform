import { ReviewsController } from './reviews.controller';
import { ReviewRefreshService } from './review-refresh.service';
import { ReviewListService } from './review-list.service';

describe('ReviewsController.refreshCompany', () => {
  it('пробрасывает companyId/brandId/userId в ReviewRefreshService', async () => {
    const refreshCompany = jest
      .fn()
      .mockResolvedValue({ yandex: null, twogis: null });
    const controller = new ReviewsController(
      { refreshCompany } as unknown as ReviewRefreshService,
      {} as ReviewListService,
    );

    const result = await controller.refreshCompany({
      companyId: 'company-1',
      brandId: 'brand-1',
      userId: 'user-1',
    });

    expect(refreshCompany).toHaveBeenCalledWith(
      'company-1',
      'brand-1',
      'user-1',
    );
    expect(result).toEqual({ yandex: null, twogis: null });
  });
});

describe('ReviewsController.listForCompany', () => {
  it('пробрасывает companyId в ReviewListService', async () => {
    const listForCompany = jest.fn().mockResolvedValue({
      reviews: [],
      aggregates: {
        combined: { total: 0, unanswered: 0, averageRating: null },
        yandex: { total: 0, unanswered: 0, averageRating: null },
        twogis: { total: 0, unanswered: 0, averageRating: null },
      },
    });
    const controller = new ReviewsController(
      {} as ReviewRefreshService,
      { listForCompany } as unknown as ReviewListService,
    );

    const result = await controller.listForCompany({ companyId: 'company-1' });

    expect(listForCompany).toHaveBeenCalledWith('company-1');
    expect(result.aggregates.combined.total).toBe(0);
  });
});

import { ReviewsController } from './reviews.controller';
import { ReviewRefreshService } from './review-refresh.service';

describe('ReviewsController.refreshCompany', () => {
  it('пробрасывает companyId/brandId/userId в ReviewRefreshService', async () => {
    const refreshCompany = jest
      .fn()
      .mockResolvedValue({ yandex: null, twogis: null });
    const controller = new ReviewsController({
      refreshCompany,
    } as unknown as ReviewRefreshService);

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

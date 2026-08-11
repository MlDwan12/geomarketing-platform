import { of } from 'rxjs';
import { ClientProxy } from '@nestjs/microservices';
import { ReviewBrandDashboardService } from './review-brand-dashboard.service';
import { ReviewListService } from './review-list.service';

function fakeCoreServiceClient(
  companies: { id: string; name: string }[],
): ClientProxy {
  return {
    send: jest.fn().mockReturnValue(of(companies)),
  } as unknown as ClientProxy;
}

describe('ReviewBrandDashboardService.getBrandDashboard', () => {
  it('считает агрегаты по каждой компании и суммирует unanswered по бренду', async () => {
    const coreServiceClient = fakeCoreServiceClient([
      { id: 'company-1', name: 'Точка 1' },
      { id: 'company-2', name: 'Точка 2' },
    ]);
    const listForCompany = jest
      .fn()
      .mockResolvedValueOnce({
        reviews: [],
        aggregates: {
          combined: { total: 5, unanswered: 2, averageRating: 4.5 },
          yandex: { total: 0, unanswered: 0, averageRating: null },
          twogis: { total: 5, unanswered: 2, averageRating: 4.5 },
        },
      })
      .mockResolvedValueOnce({
        reviews: [],
        aggregates: {
          combined: { total: 3, unanswered: 3, averageRating: 2 },
          yandex: { total: 3, unanswered: 3, averageRating: 2 },
          twogis: { total: 0, unanswered: 0, averageRating: null },
        },
      });
    const service = new ReviewBrandDashboardService(coreServiceClient, {
      listForCompany,
    } as unknown as ReviewListService);

    const result = await service.getBrandDashboard('brand-1', 'user-1');

    expect(result.totalUnanswered).toBe(5);
    expect(result.companies).toHaveLength(2);
    expect(result.companies[0]).toEqual({
      companyId: 'company-1',
      companyName: 'Точка 1',
      aggregates: {
        combined: { total: 5, unanswered: 2, averageRating: 4.5 },
        yandex: { total: 0, unanswered: 0, averageRating: null },
        twogis: { total: 5, unanswered: 2, averageRating: 4.5 },
      },
    });
  });

  it('партиальный успех — одна компания упала, остальные обрабатываются', async () => {
    const coreServiceClient = fakeCoreServiceClient([
      { id: 'company-1', name: 'Точка 1' },
      { id: 'company-2', name: 'Точка 2' },
    ]);
    const listForCompany = jest
      .fn()
      .mockRejectedValueOnce(new Error('map-parser недоступен'))
      .mockResolvedValueOnce({
        reviews: [],
        aggregates: {
          combined: { total: 1, unanswered: 1, averageRating: 5 },
          yandex: { total: 1, unanswered: 1, averageRating: 5 },
          twogis: { total: 0, unanswered: 0, averageRating: null },
        },
      });
    const service = new ReviewBrandDashboardService(coreServiceClient, {
      listForCompany,
    } as unknown as ReviewListService);

    const result = await service.getBrandDashboard('brand-1', 'user-1');

    expect(result.companies[0]).toMatchObject({
      companyId: 'company-1',
      error: 'map-parser недоступен',
    });
    expect(result.companies[0].aggregates.combined.total).toBe(0);
    expect(result.companies[1].error).toBeUndefined();
    expect(result.totalUnanswered).toBe(1);
  });

  it('пустой бренд (нет компаний) — пустой результат, не бросает исключение', async () => {
    const coreServiceClient = fakeCoreServiceClient([]);
    const service = new ReviewBrandDashboardService(coreServiceClient, {
      listForCompany: jest.fn(),
    } as unknown as ReviewListService);

    const result = await service.getBrandDashboard('brand-1', 'user-1');

    expect(result).toEqual({ companies: [], totalUnanswered: 0 });
  });

  it('батчит компании по CONCURRENCY=5 — не все запросы разом', async () => {
    const companies = Array.from({ length: 12 }, (_, i) => ({
      id: `company-${i}`,
      name: `Точка ${i}`,
    }));
    const coreServiceClient = fakeCoreServiceClient(companies);
    let maxConcurrent = 0;
    let current = 0;
    const listForCompany = jest.fn().mockImplementation(async () => {
      current += 1;
      maxConcurrent = Math.max(maxConcurrent, current);
      await new Promise((resolve) => setTimeout(resolve, 5));
      current -= 1;
      return {
        reviews: [],
        aggregates: {
          combined: { total: 0, unanswered: 0, averageRating: null },
          yandex: { total: 0, unanswered: 0, averageRating: null },
          twogis: { total: 0, unanswered: 0, averageRating: null },
        },
      };
    });
    const service = new ReviewBrandDashboardService(coreServiceClient, {
      listForCompany,
    } as unknown as ReviewListService);

    const result = await service.getBrandDashboard('brand-1', 'user-1');

    expect(result.companies).toHaveLength(12);
    expect(maxConcurrent).toBeLessThanOrEqual(5);
  });
});

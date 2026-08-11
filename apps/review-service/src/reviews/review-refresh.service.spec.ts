import { of } from 'rxjs';
import { ClientProxy } from '@nestjs/microservices';
import { ReviewRefreshService } from './review-refresh.service';
import { MapParserClientService } from '../map-parser-client/map-parser-client.service';

function fakeCoreServiceClient(
  platforms: {
    platformKey: string;
    isEnabled: boolean;
    orgId: string | null;
  }[],
): ClientProxy {
  return {
    send: jest.fn().mockReturnValue(of(platforms)),
  } as unknown as ClientProxy;
}

function fakeMapParserClient(overrides: {
  refreshYandexReviews?: jest.Mock;
  refreshTwoGisReviews?: jest.Mock;
}) {
  const refreshYandexReviews =
    overrides.refreshYandexReviews ??
    jest.fn().mockResolvedValue({ success: true, reviewsCount: 3 });
  const refreshTwoGisReviews =
    overrides.refreshTwoGisReviews ??
    jest.fn().mockResolvedValue({ success: true, reviewsCount: 5 });

  const fake = {
    refreshYandexReviews,
    refreshTwoGisReviews,
    getStoredReviews: jest.fn(),
  } as unknown as MapParserClientService;

  return { fake, refreshYandexReviews, refreshTwoGisReviews };
}

describe('ReviewRefreshService.refreshCompany', () => {
  it('обе платформы подключены — обновляет обе', async () => {
    const coreServiceClient = fakeCoreServiceClient([
      { platformKey: 'yandex', isEnabled: true, orgId: 'y-org-1' },
      { platformKey: 'twogis', isEnabled: true, orgId: '70000001057432436' },
    ]);
    const { fake, refreshYandexReviews, refreshTwoGisReviews } =
      fakeMapParserClient({});
    const service = new ReviewRefreshService(coreServiceClient, fake);

    const result = await service.refreshCompany(
      'company-1',
      'brand-1',
      'user-1',
    );

    expect(refreshYandexReviews).toHaveBeenCalledWith('company-1', 'y-org-1');
    expect(refreshTwoGisReviews).toHaveBeenCalledWith(
      'company-1',
      '70000001057432436',
    );
    expect(result).toEqual({
      yandex: { success: true, reviewsCount: 3 },
      twogis: { success: true, reviewsCount: 5 },
    });
  });

  it('только Яндекс подключён (isEnabled) — 2ГИС не трогаем, возвращаем null', async () => {
    const coreServiceClient = fakeCoreServiceClient([
      { platformKey: 'yandex', isEnabled: true, orgId: 'y-org-1' },
      { platformKey: 'twogis', isEnabled: false, orgId: null },
    ]);
    const { fake, refreshTwoGisReviews } = fakeMapParserClient({});
    const service = new ReviewRefreshService(coreServiceClient, fake);

    const result = await service.refreshCompany(
      'company-1',
      'brand-1',
      'user-1',
    );

    expect(refreshTwoGisReviews).not.toHaveBeenCalled();
    expect(result.twogis).toBeNull();
    expect(result.yandex).toEqual({ success: true, reviewsCount: 3 });
  });

  it('ни одна платформа не подключена — обе null, не бросает исключение', async () => {
    const coreServiceClient = fakeCoreServiceClient([]);
    const { fake, refreshYandexReviews, refreshTwoGisReviews } =
      fakeMapParserClient({});
    const service = new ReviewRefreshService(coreServiceClient, fake);

    const result = await service.refreshCompany(
      'company-1',
      'brand-1',
      'user-1',
    );

    expect(refreshYandexReviews).not.toHaveBeenCalled();
    expect(refreshTwoGisReviews).not.toHaveBeenCalled();
    expect(result).toEqual({ yandex: null, twogis: null });
  });

  it('партиальный успех — 2ГИС упал, Яндекс всё равно возвращается', async () => {
    const coreServiceClient = fakeCoreServiceClient([
      { platformKey: 'yandex', isEnabled: true, orgId: 'y-org-1' },
      { platformKey: 'twogis', isEnabled: true, orgId: '70000001057432436' },
    ]);
    const { fake } = fakeMapParserClient({
      refreshTwoGisReviews: jest.fn().mockResolvedValue({
        success: false,
        reviewsCount: 0,
        error: 'HTTP 500',
      }),
    });
    const service = new ReviewRefreshService(coreServiceClient, fake);

    const result = await service.refreshCompany(
      'company-1',
      'brand-1',
      'user-1',
    );

    expect(result.yandex).toEqual({ success: true, reviewsCount: 3 });
    expect(result.twogis).toEqual({
      success: false,
      reviewsCount: 0,
      error: 'HTTP 500',
    });
  });
});

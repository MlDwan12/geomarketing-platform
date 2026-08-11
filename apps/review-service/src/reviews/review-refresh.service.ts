import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { Patterns } from '@geo/contracts';
import { sendRpc } from '../common/send-rpc';
import {
  MapParserClientService,
  RefreshResult,
} from '../map-parser-client/map-parser-client.service';

// Проекция company_platforms (apps/core-service/src/company/entities/company-platform.entity.ts)
// без импорта entity core-service — review-service не тянет доменные типы других
// сервисов, только форму RPC-ответа, которая ему реально нужна.
type CompanyPlatform = {
  platformKey: string;
  isEnabled: boolean;
  orgId: string | null;
};

export type RefreshCompanyResult = {
  yandex: RefreshResult | null;
  twogis: RefreshResult | null;
};

@Injectable()
export class ReviewRefreshService {
  constructor(
    @Inject('CORE_SERVICE') private readonly coreServiceClient: ClientProxy,
    private readonly mapParserClient: MapParserClientService,
  ) {}

  async refreshCompany(
    companyId: string,
    brandId: string,
    userId: string,
  ): Promise<RefreshCompanyResult> {
    const platforms = await sendRpc<CompanyPlatform[]>(
      this.coreServiceClient,
      Patterns.COMPANY_PLATFORMS_GET,
      { companyId, brandId, userId },
    );

    const yandex = this.findConnected(platforms, 'yandex');
    const twogis = this.findConnected(platforms, 'twogis');

    const [yandexResult, twogisResult] = await Promise.all([
      yandex
        ? this.mapParserClient.refreshYandexReviews(companyId, yandex.orgId!)
        : Promise.resolve(null),
      twogis
        ? this.mapParserClient.refreshTwoGisReviews(companyId, twogis.orgId!)
        : Promise.resolve(null),
    ]);

    return { yandex: yandexResult, twogis: twogisResult };
  }

  // Обновляем только реально подключённые платформы — isEnabled=false или
  // отсутствующий orgId означает, что владелец ещё не привязал аккаунт,
  // скрапить нечего.
  private findConnected(
    platforms: CompanyPlatform[],
    platformKey: string,
  ): CompanyPlatform | undefined {
    return platforms.find(
      (p) => p.platformKey === platformKey && p.isEnabled && p.orgId,
    );
  }
}

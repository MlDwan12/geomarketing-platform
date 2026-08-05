import { Controller, Get, Headers, Inject, UseGuards } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { Patterns } from '@geo/contracts';
import { SessionGuard } from '../auth/guards/session.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { sendRpc } from '../common/rpc';

// Сеть в 50 точек × 2 провайдера — внешние запросы идут батчами по 5
// (см. MapVisibilityService), может занять десятки секунд.
const VISIBILITY_CHECK_TIMEOUT = 30000;

type CompanyForVisibility = {
  id: string;
  name: string;
  addressDisplay: string | null;
  coordinates: [number, number] | null;
};

@Controller('company-visibility')
@UseGuards(SessionGuard)
export class CompanyVisibilityController {
  constructor(
    @Inject('CORE_SERVICE')
    private readonly coreClient: ClientProxy,
    @Inject('INTEGRATION_SERVICE')
    private readonly integrationClient: ClientProxy,
  ) {}

  // GET /company-visibility/check — MapVisibility для всех Company бренда на
  // 2ГИС/Яндексе разом (аудит, без создания/изменения компаний — см.
  // CONTEXT.md, ветка "аудит/выгрузка существующих").
  @Get('check')
  async check(
    @Headers('x-brand-id') brandId: string,
    @CurrentUser() user: { userId: string },
  ) {
    const companies = await sendRpc<CompanyForVisibility[]>(
      this.coreClient,
      Patterns.COMPANY_LIST_FOR_VISIBILITY,
      { brandId, userId: user.userId },
    );

    const results = await sendRpc<unknown>(
      this.integrationClient,
      Patterns.MAP_VISIBILITY_CHECK,
      {
        companies: companies.map((c) => ({
          id: c.id,
          name: c.name,
          address: c.addressDisplay,
          coordinates: c.coordinates,
        })),
      },
      VISIBILITY_CHECK_TIMEOUT,
    );

    return { results };
  }
}

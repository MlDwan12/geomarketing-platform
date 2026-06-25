import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { Patterns } from '@geo/contracts';
import { firstValueFrom, timeout } from 'rxjs';
import { RpcExceptionFilter } from '../filters/rpc-exception.filter';
import { SessionGuard } from '../auth/guards/session.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PageQueryDto } from '../common/page-query.dto';

const RPC_TIMEOUT = 5000;

@Controller('companies')
@UseGuards(SessionGuard)
@UseFilters(RpcExceptionFilter)
export class CompaniesController {
  constructor(
    @Inject('CORE_SERVICE')
    private readonly coreClient: ClientProxy,
  ) {}

  @Get()
  list(
    @Headers('x-brand-id') brandId: string,
    @CurrentUser() user: { userId: string },
    @Query() { page, limit }: PageQueryDto,
  ) {
    return firstValueFrom(
      this.coreClient
        .send(Patterns.COMPANY_LIST, { brandId, userId: user.userId, page, limit })
        .pipe(timeout(RPC_TIMEOUT)),
    );
  }

  @Post()
  @HttpCode(201)
  create(
    @Headers('x-brand-id') brandId: string,
    @Body() body: Record<string, unknown>,
    @CurrentUser() user: { userId: string },
  ) {
    const { status, templateId, groups, code, twoGisOrgId, ...rawFields } = body as {
      status?: string;
      templateId?: string | null;
      groups?: { id: string }[];
      code?: string;
      twoGisOrgId?: string;
      [key: string]: unknown;
    };

    const namesField = rawFields.names as { default: { val: string }[] } | undefined;
    const name = namesField?.default?.[0]?.val;

    const fieldOverrides = buildFieldOverrides(rawFields, !!templateId);
    return firstValueFrom(
      this.coreClient
        .send(Patterns.COMPANY_CREATE, {
          brandId,
          userId: user.userId,
          name,
          status,
          templateId: templateId ?? null,
          code,
          twoGisOrgId,
          groups: groups ?? [],
          fieldOverrides,
        })
        .pipe(timeout(RPC_TIMEOUT)),
    );
  }

  @Get(':id')
  get(
    @Param('id') id: string,
    @Headers('x-brand-id') brandId: string,
    @CurrentUser() user: { userId: string },
  ) {
    return firstValueFrom(
      this.coreClient
        .send(Patterns.COMPANY_GET, { companyId: id, brandId, userId: user.userId })
        .pipe(timeout(RPC_TIMEOUT)),
    );
  }

  @Delete(':id')
  @HttpCode(204)
  delete(
    @Param('id') id: string,
    @Headers('x-brand-id') brandId: string,
    @CurrentUser() user: { userId: string },
  ) {
    return firstValueFrom(
      this.coreClient
        .send(Patterns.COMPANY_DELETE, { companyId: id, brandId, userId: user.userId })
        .pipe(timeout(RPC_TIMEOUT)),
    );
  }

  // GET /companies/:id/platforms — full connection data (orgId, connectedAt, syncError, ...)
  @Get(':id/platforms')
  getPlatforms(
    @Param('id') id: string,
    @Headers('x-brand-id') brandId: string,
    @CurrentUser() user: { userId: string },
  ) {
    return firstValueFrom(
      this.coreClient
        .send(Patterns.COMPANY_PLATFORMS_GET, { companyId: id, brandId, userId: user.userId })
        .pipe(timeout(RPC_TIMEOUT)),
    );
  }

  // PATCH /companies/:id/default
  @Patch(':id/default')
  updateDefault(
    @Param('id') id: string,
    @Headers('x-brand-id') brandId: string,
    @Body() dto: { templateId?: string | null; fields?: Record<string, unknown> },
    @CurrentUser() user: { userId: string },
  ) {
    return firstValueFrom(
      this.coreClient
        .send(Patterns.COMPANY_DEFAULT_UPDATE, {
          companyId: id,
          brandId,
          userId: user.userId,
          ...dto,
        })
        .pipe(timeout(RPC_TIMEOUT)),
    );
  }

  // PATCH /companies/:id/groups
  // Body: { groupIds: string[] }
  @Patch(':id/groups')
  updateGroups(
    @Param('id') id: string,
    @Headers('x-brand-id') brandId: string,
    @Body() dto: { groupIds: string[] },
    @CurrentUser() user: { userId: string },
  ) {
    return firstValueFrom(
      this.coreClient
        .send(Patterns.COMPANY_GROUPS_UPDATE, {
          companyId: id,
          brandId,
          userId: user.userId,
          groupIds: dto.groupIds,
        })
        .pipe(timeout(RPC_TIMEOUT)),
    );
  }

  // GET /companies/:slug/main_data
  @Get(':slug/main_data')
  getMainData(
    @Param('slug') slug: string,
    @Headers('x-brand-id') brandId: string,
    @CurrentUser() user: { userId: string },
  ) {
    return firstValueFrom(
      this.coreClient
        .send(Patterns.COMPANY_MAIN_DATA_GET, { companyId: slug, brandId, userId: user.userId })
        .pipe(timeout(RPC_TIMEOUT)),
    );
  }

  // PATCH /companies/:id/platforms/:platformKey
  // Body: { isEnabled?, orgId?, orgName?, status? }
  @Patch(':id/platforms/:platformKey')
  updatePlatform(
    @Param('id') id: string,
    @Param('platformKey') platformKey: string,
    @Headers('x-brand-id') brandId: string,
    @Body() dto: { isEnabled?: boolean; orgId?: string | null; orgName?: string | null },
    @CurrentUser() user: { userId: string },
  ) {
    return firstValueFrom(
      this.coreClient
        .send(Patterns.COMPANY_PLATFORM_UPDATE, {
          companyId: id,
          brandId,
          userId: user.userId,
          platformKey,
          ...dto,
        })
        .pipe(timeout(RPC_TIMEOUT)),
    );
  }
}

// Converts frontend field format to internal fieldOverrides storage format.
// All card fields use { default: value } wrapper — strips it to { value: value }.
function buildFieldOverrides(
  fields: Record<string, unknown>,
  hasTemplate: boolean,
): Record<string, { value: unknown; isException?: true }> {
  const result: Record<string, { value: unknown; isException?: true }> = {};
  for (const [key, val] of Object.entries(fields)) {
    result[key] = {
      value: (val as { default: unknown }).default,
      ...(hasTemplate ? { isException: true } : {}),
    };
  }
  return result;
}

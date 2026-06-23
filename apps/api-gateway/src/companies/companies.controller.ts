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
    @Body() dto: { name: string; code?: string; twoGisOrgId?: string; templateId?: string },
    @CurrentUser() user: { userId: string },
  ) {
    return firstValueFrom(
      this.coreClient
        .send(Patterns.COMPANY_CREATE, { ...dto, brandId, userId: user.userId })
        .pipe(timeout(RPC_TIMEOUT)),
    );
  }

  @Get(':id')
  get(@Param('id') id: string, @CurrentUser() user: { userId: string }) {
    return firstValueFrom(
      this.coreClient
        .send(Patterns.COMPANY_GET, { companyId: id, userId: user.userId })
        .pipe(timeout(RPC_TIMEOUT)),
    );
  }

  @Delete(':id')
  @HttpCode(204)
  delete(@Param('id') id: string, @CurrentUser() user: { userId: string }) {
    return firstValueFrom(
      this.coreClient
        .send(Patterns.COMPANY_DELETE, { companyId: id, userId: user.userId })
        .pipe(timeout(RPC_TIMEOUT)),
    );
  }

  // GET /companies/:id/platforms — full connection data (orgId, connectedAt, syncError, ...)
  @Get(':id/platforms')
  getPlatforms(@Param('id') id: string, @CurrentUser() user: { userId: string }) {
    return firstValueFrom(
      this.coreClient
        .send(Patterns.COMPANY_PLATFORMS_GET, { companyId: id, userId: user.userId })
        .pipe(timeout(RPC_TIMEOUT)),
    );
  }

  // PATCH /companies/:id/default
  // Body: { templateId?, fieldOverrides? }
  // fieldOverrides: { fieldName: { isException, value?, platforms? } }
  @Patch(':id/default')
  updateDefault(
    @Param('id') id: string,
    @Body() dto: { templateId?: string | null; fieldOverrides?: Record<string, unknown> },
    @CurrentUser() user: { userId: string },
  ) {
    return firstValueFrom(
      this.coreClient
        .send(Patterns.COMPANY_DEFAULT_UPDATE, {
          companyId: id,
          userId: user.userId,
          ...dto,
        })
        .pipe(timeout(RPC_TIMEOUT)),
    );
  }

  // PATCH /companies/:id/platforms/:platformKey
  // Body: { isEnabled?, orgId?, orgName?, status? }
  @Patch(':id/platforms/:platformKey')
  updatePlatform(
    @Param('id') id: string,
    @Param('platformKey') platformKey: string,
    @Body() dto: { isEnabled?: boolean; orgId?: string | null; orgName?: string | null },
    @CurrentUser() user: { userId: string },
  ) {
    return firstValueFrom(
      this.coreClient
        .send(Patterns.COMPANY_PLATFORM_UPDATE, {
          companyId: id,
          userId: user.userId,
          platformKey,
          ...dto,
        })
        .pipe(timeout(RPC_TIMEOUT)),
    );
  }
}

import {
  Body,
  Controller,
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
    @Body() dto: { name: string; code?: string },
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

  @Get(':id/card')
  getCard(@Param('id') id: string, @CurrentUser() user: { userId: string }) {
    return firstValueFrom(
      this.coreClient
        .send(Patterns.COMPANY_GET_CARD, { companyId: id, userId: user.userId })
        .pipe(timeout(RPC_TIMEOUT)),
    );
  }

  @Patch(':id/card')
  updateCard(
    @Param('id') id: string,
    @Body() fields: Record<string, unknown>,
    @CurrentUser() user: { userId: string },
  ) {
    return firstValueFrom(
      this.coreClient
        .send(Patterns.COMPANY_UPDATE_CARD, {
          companyId: id,
          userId: user.userId,
          fields,
        })
        .pipe(timeout(RPC_TIMEOUT)),
    );
  }
}

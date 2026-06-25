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

const RPC_TIMEOUT = 5000;

@Controller('groups')
@UseGuards(SessionGuard)
@UseFilters(RpcExceptionFilter)
export class GroupsController {
  constructor(
    @Inject('CORE_SERVICE')
    private readonly coreClient: ClientProxy,
  ) {}

  @Get()
  list(
    @Headers('x-brand-id') brandId: string,
    @CurrentUser() user: { userId: string },
    @Query('search') search?: string,
  ) {
    return firstValueFrom(
      this.coreClient
        .send(Patterns.GROUP_LIST, { brandId, userId: user.userId, search })
        .pipe(timeout(RPC_TIMEOUT)),
    );
  }

  @Get('stats')
  listStats(
    @Headers('x-brand-id') brandId: string,
    @CurrentUser() user: { userId: string },
    @Query('search') search?: string,
  ) {
    return firstValueFrom(
      this.coreClient
        .send(Patterns.GROUP_LIST_STATS, { brandId, userId: user.userId, search })
        .pipe(timeout(RPC_TIMEOUT)),
    );
  }

  @Post()
  @HttpCode(201)
  create(
    @Headers('x-brand-id') brandId: string,
    @Body() dto: { name: string },
    @CurrentUser() user: { userId: string },
  ) {
    return firstValueFrom(
      this.coreClient
        .send(Patterns.GROUP_CREATE, { brandId, userId: user.userId, name: dto.name })
        .pipe(timeout(RPC_TIMEOUT)),
    );
  }

  @Get(':id')
  get(
    @Param('id') groupId: string,
    @Headers('x-brand-id') brandId: string,
    @CurrentUser() user: { userId: string },
  ) {
    return firstValueFrom(
      this.coreClient
        .send(Patterns.GROUP_GET, { groupId, brandId, userId: user.userId })
        .pipe(timeout(RPC_TIMEOUT)),
    );
  }

  @Post(':id/companies')
  @HttpCode(200)
  addCompanies(
    @Param('id') groupId: string,
    @Headers('x-brand-id') brandId: string,
    @Body() dto: { companyIds: string[] },
    @CurrentUser() user: { userId: string },
  ) {
    return firstValueFrom(
      this.coreClient
        .send(Patterns.GROUP_ADD_COMPANIES, { groupId, brandId, userId: user.userId, companyIds: dto.companyIds })
        .pipe(timeout(RPC_TIMEOUT)),
    );
  }

  @Delete(':id/companies')
  @HttpCode(200)
  removeCompanies(
    @Param('id') groupId: string,
    @Headers('x-brand-id') brandId: string,
    @Body() dto: { companyIds: string[] },
    @CurrentUser() user: { userId: string },
  ) {
    return firstValueFrom(
      this.coreClient
        .send(Patterns.GROUP_REMOVE_COMPANIES, { groupId, brandId, userId: user.userId, companyIds: dto.companyIds })
        .pipe(timeout(RPC_TIMEOUT)),
    );
  }

  @Patch(':id')
  update(
    @Param('id') groupId: string,
    @Headers('x-brand-id') brandId: string,
    @Body() dto: { name: string },
    @CurrentUser() user: { userId: string },
  ) {
    return firstValueFrom(
      this.coreClient
        .send(Patterns.GROUP_UPDATE, { groupId, brandId, userId: user.userId, name: dto.name })
        .pipe(timeout(RPC_TIMEOUT)),
    );
  }

  @Delete(':id')
  @HttpCode(204)
  delete(
    @Param('id') groupId: string,
    @Headers('x-brand-id') brandId: string,
    @CurrentUser() user: { userId: string },
  ) {
    return firstValueFrom(
      this.coreClient
        .send(Patterns.GROUP_DELETE, { groupId, brandId, userId: user.userId })
        .pipe(timeout(RPC_TIMEOUT)),
    );
  }
}

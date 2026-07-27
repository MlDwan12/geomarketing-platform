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
import { RpcExceptionFilter } from '../filters/rpc-exception.filter';
import { SessionGuard } from '../auth/guards/session.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { sendRpc } from '../common/rpc';

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
    return sendRpc(this.coreClient, Patterns.GROUP_LIST, {
      brandId,
      userId: user.userId,
      search,
    });
  }

  @Get('stats')
  listStats(
    @Headers('x-brand-id') brandId: string,
    @CurrentUser() user: { userId: string },
    @Query('search') search?: string,
  ) {
    return sendRpc(this.coreClient, Patterns.GROUP_LIST_STATS, {
      brandId,
      userId: user.userId,
      search,
    });
  }

  @Post()
  @HttpCode(201)
  create(
    @Headers('x-brand-id') brandId: string,
    @Body() dto: { name: string },
    @CurrentUser() user: { userId: string },
  ) {
    return sendRpc(this.coreClient, Patterns.GROUP_CREATE, {
      brandId,
      userId: user.userId,
      name: dto.name,
    });
  }

  @Get(':id')
  get(
    @Param('id') groupId: string,
    @Headers('x-brand-id') brandId: string,
    @CurrentUser() user: { userId: string },
  ) {
    return sendRpc(this.coreClient, Patterns.GROUP_GET, {
      groupId,
      brandId,
      userId: user.userId,
    });
  }

  @Post(':id/companies')
  @HttpCode(200)
  addCompanies(
    @Param('id') groupId: string,
    @Headers('x-brand-id') brandId: string,
    @Body() dto: { companyIds: string[] },
    @CurrentUser() user: { userId: string },
  ) {
    return sendRpc(this.coreClient, Patterns.GROUP_ADD_COMPANIES, {
      groupId,
      brandId,
      userId: user.userId,
      companyIds: dto.companyIds,
    });
  }

  @Delete(':id/companies')
  @HttpCode(200)
  removeCompanies(
    @Param('id') groupId: string,
    @Headers('x-brand-id') brandId: string,
    @Body() dto: { companyIds: string[] },
    @CurrentUser() user: { userId: string },
  ) {
    return sendRpc(this.coreClient, Patterns.GROUP_REMOVE_COMPANIES, {
      groupId,
      brandId,
      userId: user.userId,
      companyIds: dto.companyIds,
    });
  }

  @Patch(':id')
  update(
    @Param('id') groupId: string,
    @Headers('x-brand-id') brandId: string,
    @Body() dto: { name: string },
    @CurrentUser() user: { userId: string },
  ) {
    return sendRpc(this.coreClient, Patterns.GROUP_UPDATE, {
      groupId,
      brandId,
      userId: user.userId,
      name: dto.name,
    });
  }

  @Delete(':id')
  @HttpCode(204)
  delete(
    @Param('id') groupId: string,
    @Headers('x-brand-id') brandId: string,
    @CurrentUser() user: { userId: string },
  ) {
    return sendRpc(this.coreClient, Patterns.GROUP_DELETE, {
      groupId,
      brandId,
      userId: user.userId,
    });
  }
}

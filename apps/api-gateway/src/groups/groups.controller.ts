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
import {
  ApiBody,
  ApiCookieAuth,
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Patterns } from '@geo/contracts';
import { RpcExceptionFilter } from '../filters/rpc-exception.filter';
import { SessionGuard } from '../auth/guards/session.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { sendRpc } from '../common/rpc';
import {
  GroupCompaniesMutationResponseDto,
  GroupDetailResponseDto,
  GroupEntityResponseDto,
  GroupShortResponseDto,
  GroupStatsResponseDto,
} from './dto/group-response.dto';

@ApiTags('groups')
@ApiCookieAuth()
@ApiHeader({
  name: 'x-brand-id',
  required: true,
  description: 'id текущего бренда',
})
@Controller('groups')
@UseGuards(SessionGuard)
@UseFilters(RpcExceptionFilter)
export class GroupsController {
  constructor(
    @Inject('CORE_SERVICE')
    private readonly coreClient: ClientProxy,
  ) {}

  @ApiOperation({ summary: 'Короткий список групп бренда (для дропдаунов)' })
  @ApiQuery({ name: 'search', required: false })
  @ApiResponse({ status: 200, type: GroupShortResponseDto, isArray: true })
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

  @ApiOperation({ summary: 'Группы бренда с количеством компаний в каждой' })
  @ApiQuery({ name: 'search', required: false })
  @ApiResponse({ status: 200, type: GroupStatsResponseDto, isArray: true })
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

  @ApiOperation({ summary: 'Создать группу компаний' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { name: { type: 'string' } },
      required: ['name'],
    },
  })
  @ApiResponse({ status: 201, type: GroupEntityResponseDto })
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

  @ApiOperation({ summary: 'Получить группу со списком компаний' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: GroupDetailResponseDto })
  @ApiResponse({ status: 404, description: 'Группа не найдена/другой бренд' })
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

  @ApiOperation({
    summary: 'Добавить компании в группу',
    description:
      'Идемпотентно (ON CONFLICT DO NOTHING) — уже состоящие в группе id не дублируются.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        companyIds: {
          type: 'array',
          items: { type: 'string', format: 'uuid' },
        },
      },
      required: ['companyIds'],
    },
  })
  @ApiResponse({ status: 200, type: GroupCompaniesMutationResponseDto })
  @ApiResponse({
    status: 400,
    description: 'Один или несколько companyId не из этого бренда',
  })
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

  @ApiOperation({ summary: 'Удалить компании из группы' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        companyIds: {
          type: 'array',
          items: { type: 'string', format: 'uuid' },
        },
      },
      required: ['companyIds'],
    },
  })
  @ApiResponse({ status: 200, type: GroupCompaniesMutationResponseDto })
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

  @ApiOperation({ summary: 'Переименовать группу' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { name: { type: 'string' } },
      required: ['name'],
    },
  })
  @ApiResponse({ status: 200, type: GroupEntityResponseDto })
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

  @ApiOperation({ summary: 'Удалить группу' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Удалена' })
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

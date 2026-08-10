import {
  BadRequestException,
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
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Patterns } from '@geo/contracts';
import { RpcExceptionFilter } from '../filters/rpc-exception.filter';
import { SessionGuard } from '../auth/guards/session.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PageQueryDto } from '../common/page-query.dto';
import { sendRpc } from '../common/rpc';
import {
  CompanyCardDto,
  CompanyDetailResponseDto,
  CompanyMainDataResponseDto,
  CompanyPlatformResponseDto,
  CompanyResponseDto,
  PaginatedCompaniesResponseDto,
  UpdateCompanyGroupsResponseDto,
} from './dto/company-response.dto';
import { UpdateCompanyDefaultDto } from './dto/update-company-default.dto';
import { UpdateCompanyPlatformDto } from './dto/update-company-platform.dto';

// Динамический JSON-объект карточки на входе create() — форма { fieldKey: { default: value } },
// см. buildFieldOverrides ниже. Набор ключей зависит от шаблона бренда, поэтому
// задокументирован как additionalProperties, а не фиксированный список.
const createCompanyBody = {
  type: 'object',
  properties: {
    status: {
      type: 'string',
      enum: [
        'draft',
        'active',
        'temporarily_closed',
        'closed',
        'suspended',
        'deleted',
      ],
    },
    templateId: { type: 'string', format: 'uuid', nullable: true },
    groups: {
      type: 'array',
      items: { type: 'object', properties: { id: { type: 'string' } } },
    },
    code: { type: 'string' },
    twoGisOrgId: { type: 'string' },
    addressDisplay: { type: 'string', nullable: true },
    coordinates: {
      type: 'array',
      items: { type: 'number' },
      minItems: 2,
      maxItems: 2,
      description: '[lon, lat] — для проверки присутствия на 2ГИС/Яндекс',
      nullable: true,
    },
  },
  additionalProperties: {
    type: 'object',
    description: 'Поле карточки, форма { default: значение }',
    properties: { default: {} },
  },
  example: {
    names: { default: [{ lang: 'ru', val: 'Кафе Пушкинъ' }] },
    status: 'active',
  },
};

@ApiTags('companies')
@ApiCookieAuth()
@ApiHeader({
  name: 'x-brand-id',
  required: true,
  description: 'id текущего бренда',
})
@Controller('companies')
@UseGuards(SessionGuard)
@UseFilters(RpcExceptionFilter)
export class CompaniesController {
  constructor(
    @Inject('CORE_SERVICE')
    private readonly coreClient: ClientProxy,
  ) {}

  @ApiOperation({ summary: 'Список компаний бренда (постранично)' })
  @ApiResponse({ status: 200, type: PaginatedCompaniesResponseDto })
  @Get()
  list(
    @Headers('x-brand-id') brandId: string,
    @CurrentUser() user: { userId: string },
    @Query() { page, limit }: PageQueryDto,
  ) {
    return sendRpc(this.coreClient, Patterns.COMPANY_LIST, {
      brandId,
      userId: user.userId,
      page,
      limit,
    });
  }

  @ApiOperation({
    summary: 'Создать компанию',
    description:
      'Тело — плоский JSON: известные поля (status/templateId/groups/code/' +
      'twoGisOrgId) + произвольные поля карточки в форме { default: значение } ' +
      '(набор зависит от шаблона бренда). name берётся из fieldOverrides.names, ' +
      'если не передан явно.',
  })
  @ApiBody({ schema: createCompanyBody })
  @ApiResponse({
    status: 201,
    description:
      'Плоская Company (без groups/card/platformsInfo — см. GET /companies/:id)',
    type: CompanyResponseDto,
  })
  @Post()
  @HttpCode(201)
  create(
    @Headers('x-brand-id') brandId: string,
    @Body() body: Record<string, unknown>,
    @CurrentUser() user: { userId: string },
  ) {
    const {
      status,
      templateId,
      groups,
      code,
      twoGisOrgId,
      addressDisplay,
      coordinates,
      ...rawFields
    } = body as {
      status?: string;
      templateId?: string | null;
      groups?: { id: string }[];
      code?: string;
      twoGisOrgId?: string;
      addressDisplay?: string | null;
      coordinates?: [number, number] | null;
      [key: string]: unknown;
    };

    if (
      coordinates != null &&
      (!Array.isArray(coordinates) ||
        coordinates.length !== 2 ||
        !coordinates.every((c) => typeof c === 'number' && Number.isFinite(c)))
    ) {
      throw new BadRequestException(
        'coordinates должны быть массивом [lon, lat] из двух чисел',
      );
    }

    const namesField = rawFields.names as
      | { default: { val: string }[] }
      | undefined;
    const name = namesField?.default?.[0]?.val;

    const fieldOverrides = buildFieldOverrides(rawFields, !!templateId);
    return sendRpc(this.coreClient, Patterns.COMPANY_CREATE, {
      brandId,
      userId: user.userId,
      name,
      status,
      templateId: templateId ?? null,
      code,
      twoGisOrgId,
      addressDisplay: addressDisplay ?? null,
      coordinates: coordinates ?? null,
      groups: groups ?? [],
      fieldOverrides,
    });
  }

  @ApiOperation({
    summary: 'Получить компанию (с карточкой/группами/платформами)',
  })
  @ApiParam({ name: 'id', description: 'id или slug компании' })
  @ApiResponse({ status: 200, type: CompanyDetailResponseDto })
  @ApiResponse({ status: 404, description: 'Компания не найдена/другой бренд' })
  @Get(':id')
  get(
    @Param('id') id: string,
    @Headers('x-brand-id') brandId: string,
    @CurrentUser() user: { userId: string },
  ) {
    return sendRpc(this.coreClient, Patterns.COMPANY_GET, {
      companyId: id,
      brandId,
      userId: user.userId,
    });
  }

  @ApiOperation({ summary: 'Удалить компанию (мягко, status=deleted)' })
  @ApiParam({ name: 'id', description: 'id или slug компании' })
  @ApiResponse({ status: 204, description: 'Удалена' })
  @ApiResponse({ status: 404, description: 'Компания не найдена/другой бренд' })
  @Delete(':id')
  @HttpCode(204)
  delete(
    @Param('id') id: string,
    @Headers('x-brand-id') brandId: string,
    @CurrentUser() user: { userId: string },
  ) {
    return sendRpc(this.coreClient, Patterns.COMPANY_DELETE, {
      companyId: id,
      brandId,
      userId: user.userId,
    });
  }

  // GET /companies/:id/platforms — full connection data (orgId, connectedAt, syncError, ...)
  @ApiOperation({ summary: 'Данные подключений компании ко всем платформам' })
  @ApiParam({ name: 'id', description: 'id или slug компании' })
  @ApiResponse({ status: 200, type: CompanyPlatformResponseDto, isArray: true })
  @Get(':id/platforms')
  getPlatforms(
    @Param('id') id: string,
    @Headers('x-brand-id') brandId: string,
    @CurrentUser() user: { userId: string },
  ) {
    return sendRpc(this.coreClient, Patterns.COMPANY_PLATFORMS_GET, {
      companyId: id,
      brandId,
      userId: user.userId,
    });
  }

  // PATCH /companies/:id/default
  @ApiOperation({
    summary: 'Обновить шаблон/переопределения полей карточки компании',
    description:
      'fields мержится на уровне отдельных полей — непереданные ключи не трогаются.',
  })
  @ApiParam({ name: 'id', description: 'id или slug компании' })
  @ApiBody({ type: UpdateCompanyDefaultDto })
  @ApiResponse({ status: 200, type: CompanyCardDto })
  @Patch(':id/default')
  updateDefault(
    @Param('id') id: string,
    @Headers('x-brand-id') brandId: string,
    @Body() dto: UpdateCompanyDefaultDto,
    @CurrentUser() user: { userId: string },
  ) {
    return sendRpc(this.coreClient, Patterns.COMPANY_DEFAULT_UPDATE, {
      companyId: id,
      brandId,
      userId: user.userId,
      ...dto,
    });
  }

  // PATCH /companies/:id/groups
  // Body: { groupIds: string[] }
  @ApiOperation({ summary: 'Заменить набор групп компании целиком' })
  @ApiParam({ name: 'id', description: 'id или slug компании' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        groupIds: { type: 'array', items: { type: 'string', format: 'uuid' } },
      },
      required: ['groupIds'],
    },
  })
  @ApiResponse({ status: 200, type: UpdateCompanyGroupsResponseDto })
  @ApiResponse({
    status: 400,
    description: 'Один или несколько groupId не из этого бренда',
  })
  @Patch(':id/groups')
  updateGroups(
    @Param('id') id: string,
    @Headers('x-brand-id') brandId: string,
    @Body() dto: { groupIds: string[] },
    @CurrentUser() user: { userId: string },
  ) {
    return sendRpc(this.coreClient, Patterns.COMPANY_GROUPS_UPDATE, {
      companyId: id,
      brandId,
      userId: user.userId,
      groupIds: dto.groupIds,
    });
  }

  // GET /companies/:slug/main_data
  @ApiOperation({
    summary: 'Плоский набор данных для формы редактирования карточки',
  })
  @ApiParam({ name: 'slug', description: 'id или slug компании' })
  @ApiResponse({ status: 200, type: CompanyMainDataResponseDto })
  @Get(':slug/main_data')
  getMainData(
    @Param('slug') slug: string,
    @Headers('x-brand-id') brandId: string,
    @CurrentUser() user: { userId: string },
  ) {
    return sendRpc(this.coreClient, Patterns.COMPANY_MAIN_DATA_GET, {
      companyId: slug,
      brandId,
      userId: user.userId,
    });
  }

  // PATCH /companies/:id/platforms/:platformKey
  // Body: { isEnabled?, orgId?, orgName?, status? }
  @ApiOperation({
    summary: 'Обновить подключение компании к платформе',
    description:
      'Создаёт запись подключения, если её ещё не было. Если передан orgId ' +
      'и подключение раньше не было установлено — connectedAt/status ' +
      'проставляются автоматически.',
  })
  @ApiParam({ name: 'id', description: 'id или slug компании' })
  @ApiParam({ name: 'platformKey', description: 'напр. "2gis", "yandex"' })
  @ApiBody({ type: UpdateCompanyPlatformDto })
  @ApiResponse({ status: 200, type: CompanyPlatformResponseDto })
  @Patch(':id/platforms/:platformKey')
  updatePlatform(
    @Param('id') id: string,
    @Param('platformKey') platformKey: string,
    @Headers('x-brand-id') brandId: string,
    @Body() dto: UpdateCompanyPlatformDto,
    @CurrentUser() user: { userId: string },
  ) {
    return sendRpc(this.coreClient, Patterns.COMPANY_PLATFORM_UPDATE, {
      companyId: id,
      brandId,
      userId: user.userId,
      platformKey,
      ...dto,
    });
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

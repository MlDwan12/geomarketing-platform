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
import { sendRpc } from '../common/rpc';
import {
  TemplateDetailResponseDto,
  TemplateEntityResponseDto,
  TemplateShortResponseDto,
  TemplateStatsResponseDto,
} from './dto/template-response.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';

const templateFieldsBodySchema = {
  type: 'object',
  additionalProperties: true,
  description:
    'Плоские значения полей карточки: { names: {default:[...]}, phones: {default:[...]}, ... }',
} as const;

@ApiTags('templates')
@ApiCookieAuth()
@ApiHeader({
  name: 'x-brand-id',
  required: true,
  description: 'id текущего бренда',
})
@Controller('templates')
@UseGuards(SessionGuard)
@UseFilters(RpcExceptionFilter)
export class TemplatesController {
  constructor(
    @Inject('CORE_SERVICE')
    private readonly coreClient: ClientProxy,
  ) {}

  // GET /templates  — короткий список [{ id, name }] для дропдаунов (x-brand-id)
  @ApiOperation({ summary: 'Короткий список шаблонов бренда (для дропдаунов)' })
  @ApiResponse({ status: 200, type: TemplateShortResponseDto, isArray: true })
  @Get()
  list(
    @Headers('x-brand-id') brandId: string,
    @CurrentUser() user: { userId: string },
  ) {
    return sendRpc(this.coreClient, Patterns.TEMPLATE_LIST, {
      brandId,
      userId: user.userId,
    });
  }

  // GET /templates/stats — все шаблоны текущего бренда с кол. компаний
  @ApiOperation({
    summary: 'Шаблоны бренда с количеством привязанных компаний',
  })
  @ApiResponse({ status: 200, type: TemplateStatsResponseDto, isArray: true })
  @Get('stats')
  listStats(
    @Headers('x-brand-id') brandId: string,
    @CurrentUser() user: { userId: string },
  ) {
    return sendRpc(this.coreClient, Patterns.TEMPLATE_LIST_STATS, {
      brandId,
      userId: user.userId,
    });
  }

  // GET /templates/:id — шаблон с полями и списком компаний
  @ApiOperation({
    summary: 'Шаблон со значениями полей и списком привязанных компаний',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: TemplateDetailResponseDto })
  @ApiResponse({ status: 404, description: 'Шаблон не найден/другой бренд' })
  @Get(':id')
  get(
    @Param('id') id: string,
    @Headers('x-brand-id') brandId: string,
    @CurrentUser() user: { userId: string },
  ) {
    return sendRpc(this.coreClient, Patterns.TEMPLATE_GET, {
      templateId: id,
      brandId,
      userId: user.userId,
    });
  }

  // POST /templates
  // Body: { name, fields }
  // fields: { names: { default: [...] }, phones: { default: [...] }, ... }
  @ApiOperation({ summary: 'Создать шаблон карточки' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        fields: templateFieldsBodySchema,
      },
      required: ['name', 'fields'],
    },
  })
  @ApiResponse({ status: 201, type: TemplateEntityResponseDto })
  @Post()
  @HttpCode(201)
  create(
    @Headers('x-brand-id') brandId: string,
    @Body() dto: { name: string; fields: Record<string, unknown> },
    @CurrentUser() user: { userId: string },
  ) {
    return sendRpc(this.coreClient, Patterns.TEMPLATE_CREATE, {
      ...dto,
      brandId,
      userId: user.userId,
    });
  }

  // PATCH /templates/:id
  // Body: { name?, fields? }
  @ApiOperation({
    summary: 'Обновить шаблон',
    description:
      'fields, если передан, заменяет весь объект целиком (не мержится по ключам, в отличие от PATCH /companies/:id/default).',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({ type: UpdateTemplateDto })
  @ApiResponse({ status: 200, type: TemplateEntityResponseDto })
  @ApiResponse({ status: 404, description: 'Шаблон не найден/другой бренд' })
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Headers('x-brand-id') brandId: string,
    @Body() dto: UpdateTemplateDto,
    @CurrentUser() user: { userId: string },
  ) {
    return sendRpc(this.coreClient, Patterns.TEMPLATE_UPDATE, {
      templateId: id,
      brandId,
      userId: user.userId,
      ...dto,
    });
  }

  // DELETE /templates/:id
  @ApiOperation({
    summary: 'Удалить шаблон',
    description:
      'Компании, привязанные к шаблону, открепляются (templateId → null), не удаляются.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Удалён' })
  @Delete(':id')
  @HttpCode(204)
  delete(
    @Param('id') id: string,
    @Headers('x-brand-id') brandId: string,
    @CurrentUser() user: { userId: string },
  ) {
    return sendRpc(this.coreClient, Patterns.TEMPLATE_DELETE, {
      templateId: id,
      brandId,
      userId: user.userId,
    });
  }
}

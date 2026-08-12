import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Inject,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  ApiCookieAuth,
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Patterns } from '@geo/contracts';
import { SessionGuard } from '../auth/guards/session.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { sendRpc } from '../common/rpc';
import { AddKeywordDto } from './dto/add-keyword.dto';

// Постоянный список ручных ключевых слов на компанию для чекера позиций (см.
// docs/refactor-plans/position-checker.md, коммит 4). Сама проверка позиции
// (коммит 5) — отдельный эндпоинт, здесь только CRUD списка.
@ApiTags('position-check')
@ApiCookieAuth()
@ApiHeader({
  name: 'x-brand-id',
  required: true,
  description: 'id текущего бренда',
})
@Controller('companies/:companyId/keywords')
@UseGuards(SessionGuard)
export class PositionCheckController {
  constructor(
    @Inject('CORE_SERVICE') private readonly coreClient: ClientProxy,
  ) {}

  @ApiOperation({
    summary: 'Добавить ручное ключевое слово для проверки позиции',
    description:
      'Повторное добавление того же слова не создаёт дубль — возвращает ' +
      'уже существующую запись.',
  })
  @ApiParam({ name: 'companyId', format: 'uuid' })
  @Post()
  add(
    @Param('companyId') companyId: string,
    @Headers('x-brand-id') brandId: string,
    @CurrentUser() user: { userId: string },
    @Body() dto: AddKeywordDto,
  ) {
    return sendRpc(this.coreClient, Patterns.POSITION_KEYWORDS_ADD, {
      companyId,
      brandId,
      userId: user.userId,
      keyword: dto.keyword,
    });
  }

  @ApiOperation({ summary: 'Удалить ручное ключевое слово' })
  @ApiParam({ name: 'companyId', format: 'uuid' })
  @ApiParam({ name: 'keyword' })
  @Delete(':keyword')
  remove(
    @Param('companyId') companyId: string,
    @Param('keyword') keyword: string,
    @Headers('x-brand-id') brandId: string,
    @CurrentUser() user: { userId: string },
  ) {
    return sendRpc(this.coreClient, Patterns.POSITION_KEYWORDS_REMOVE, {
      companyId,
      brandId,
      userId: user.userId,
      keyword,
    });
  }

  @ApiOperation({
    summary: 'Список ручных ключевых слов компании',
    description:
      'Только ручные — авто-слово из категории карточки сюда не входит ' +
      '(читается заново при каждой проверке позиции, не хранится).',
  })
  @ApiParam({ name: 'companyId', format: 'uuid' })
  @Get()
  list(
    @Param('companyId') companyId: string,
    @Headers('x-brand-id') brandId: string,
    @CurrentUser() user: { userId: string },
  ) {
    return sendRpc(this.coreClient, Patterns.POSITION_KEYWORDS_LIST, {
      companyId,
      brandId,
      userId: user.userId,
    });
  }
}

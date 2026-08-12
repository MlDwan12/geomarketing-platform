import {
  Controller,
  Get,
  Headers,
  Inject,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  ApiCookieAuth,
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Patterns } from '@geo/contracts';
import { SessionGuard } from '../auth/guards/session.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { sendRpc } from '../common/rpc';
import { PositionCheckOrchestratorService } from './position-check-orchestrator.service';

// Запуск проверки позиции + чтение истории (см.
// docs/refactor-plans/position-checker.md, коммиты 5-6) — отдельный
// контроллер от CRUD ключевых слов (PositionCheckController), т.к. базовый
// путь другой (position-check, не keywords).
@ApiTags('position-check')
@ApiCookieAuth()
@ApiHeader({
  name: 'x-brand-id',
  required: true,
  description: 'id текущего бренда',
})
@Controller('companies/:companyId/position-check')
@UseGuards(SessionGuard)
export class PositionCheckRunController {
  constructor(
    private readonly orchestrator: PositionCheckOrchestratorService,
    @Inject('CORE_SERVICE') private readonly coreClient: ClientProxy,
  ) {}

  @ApiOperation({
    summary: 'Проверить позицию компании по авто+ручным ключевым словам',
    description:
      'Авто — категория из card.fields.mainCategory (если есть), не хранится ' +
      'как TrackedKeyword. Ручные — из GET .../keywords. Топ-10 на 2ГИС+Яндекс, ' +
      'каждая проверка — новые строки истории (не перезапись).',
  })
  @ApiParam({ name: 'companyId', format: 'uuid' })
  @Post()
  check(
    @Param('companyId') companyId: string,
    @Headers('x-brand-id') brandId: string,
    @CurrentUser() user: { userId: string },
  ) {
    return this.orchestrator.checkPositions(companyId, brandId, user.userId);
  }

  @ApiOperation({
    summary: 'История проверок позиции компании',
    description:
      'Read-only, не триггерит проверку. Без keyword — вся история, ' +
      'отсортированная по дате (свежие первые).',
  })
  @ApiParam({ name: 'companyId', format: 'uuid' })
  @ApiQuery({ name: 'keyword', required: false })
  @Get('history')
  history(
    @Param('companyId') companyId: string,
    @Headers('x-brand-id') brandId: string,
    @CurrentUser() user: { userId: string },
    @Query('keyword') keyword?: string,
  ) {
    return sendRpc(this.coreClient, Patterns.POSITION_CHECK_HISTORY, {
      companyId,
      brandId,
      userId: user.userId,
      keyword,
    });
  }
}

import { Controller, Headers, Param, Post, UseGuards } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { SessionGuard } from '../auth/guards/session.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PositionCheckOrchestratorService } from './position-check-orchestrator.service';

// Запуск проверки позиции (см. docs/refactor-plans/position-checker.md,
// коммит 5) — отдельный контроллер от CRUD ключевых слов
// (PositionCheckController), т.к. базовый путь другой (position-check, не
// keywords) и логика — оркестрация, не простой RPC-passthrough.
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
}

import { Controller, Headers, Post, UseGuards } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiHeader,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { SessionGuard } from '../auth/guards/session.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PositionCheckOrchestratorService } from './position-check-orchestrator.service';

// POST /position-check/brand — проверить позицию ВСЕХ Company бренда разом
// (см. docs/refactor-plans/position-checker-brand-batch.md, коммит 2).
// Отдельный контроллер от PositionCheckRunController — тот вложен под
// companies/:companyId, здесь ресурс не привязан к конкретной компании,
// бренд передаётся как везде через заголовок x-brand-id (тот же принцип,
// что POST /competitor-analysis/brand).
@ApiTags('position-check')
@ApiCookieAuth()
@ApiHeader({
  name: 'x-brand-id',
  required: true,
  description: 'id текущего бренда',
})
@Controller('position-check')
@UseGuards(SessionGuard)
export class PositionCheckBrandController {
  constructor(
    private readonly orchestrator: PositionCheckOrchestratorService,
  ) {}

  @ApiOperation({
    summary: 'Проверить позицию ВСЕХ компаний бренда',
    description:
      'Батчами по 5 компаний параллельно. Партиальный успех — падение ' +
      'проверки для одной компании (сеть/RPC) не прерывает батч, для неё ' +
      'вернётся { success: false, error }. Компания без ключевых слов ' +
      '(нет категории и ручных слов) или без координат — { success: true, ' +
      'results: [] }, это не ошибка.',
  })
  @Post('brand')
  checkForBrand(
    @Headers('x-brand-id') brandId: string,
    @CurrentUser() user: { userId: string },
  ) {
    return this.orchestrator.checkPositionsForBrand(brandId, user.userId);
  }
}

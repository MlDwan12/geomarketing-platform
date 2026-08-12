import { Controller, Inject, Post, UseGuards } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { ApiExcludeController } from '@nestjs/swagger';
import { Patterns } from '@geo/contracts';
import { sendRpc } from '../common/rpc';
import { InternalTokenGuard } from '../common/internal-token.guard';

// POST /position-check/cleanup — retention старой истории Чекера позиций
// (см. docs/refactor-plans/position-checker-retention.md, коммит 7).
// Служебная операция над всеми брендами разом (не user-facing) — отдельный
// контроллер от PositionCheckBrandController: та защищена SessionGuard+
// x-brand-id для конкретного бренда, здесь — InternalTokenGuard, без сессии
// и без привязки к бренду. Тонкий проброс RPC напрямую (без оркестратора) —
// тот же приём, что history() в PositionCheckRunController.
// ApiExcludeController — не часть публичного API, вызывается вручную или из
// внешнего cron, не из UI.
@ApiExcludeController()
@Controller('position-check')
@UseGuards(InternalTokenGuard)
export class PositionCheckCleanupController {
  constructor(
    @Inject('CORE_SERVICE') private readonly coreClient: ClientProxy,
  ) {}

  @Post('cleanup')
  cleanup() {
    return sendRpc(this.coreClient, Patterns.POSITION_CHECK_CLEANUP_RUN, {});
  }
}

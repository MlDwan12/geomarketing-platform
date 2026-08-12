import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PositionCheckCleanupService } from './position-check-cleanup.service';

// Автоматический путь запуска retention (см.
// docs/refactor-plans/position-checker-retention.md, коммит 5) — вызывает
// тот же PositionCheckCleanupService.runCleanup(), что и ручной RPC-триггер
// (PositionCheckController.cleanupRun), напрямую, без RMQ-круга — тот же
// процесс, тот же метод. Расписание в v1 не настраивается через env — не в
// скоупе (см. Out of Scope плана).
@Injectable()
export class PositionCheckCleanupScheduler {
  private readonly logger = new Logger(PositionCheckCleanupScheduler.name);

  constructor(private readonly cleanup: PositionCheckCleanupService) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleCron(): Promise<void> {
    const summary = await this.cleanup.runCleanup();
    this.logger.log(
      `Плановая очистка истории Чекера позиций: ${summary.companiesProcessed} компаний, ${summary.recordsArchived} записей архивировано`,
    );
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { PositionCheckResult } from '../entities/position-check-result.entity';
import {
  ArchivedPositionCheckRecord,
  PositionCheckArchiveStoreService,
} from '../archive/position-check-archive-store.service';

const DEFAULT_RETENTION_DAYS = 90;

export interface PositionCheckCleanupSummary {
  companiesProcessed: number;
  recordsArchived: number;
}

// Retention старой истории Чекера позиций (см.
// docs/refactor-plans/position-checker-retention.md, коммит 3) — общий метод
// для обоих путей запуска (ручной RPC-триггер и @Cron()), см.
// PositionCheckController/PositionCheckCleanupScheduler.
@Injectable()
export class PositionCheckCleanupService {
  private readonly logger = new Logger(PositionCheckCleanupService.name);

  constructor(
    @InjectRepository(PositionCheckResult)
    private readonly resultRepo: Repository<PositionCheckResult>,
    private readonly archiveStore: PositionCheckArchiveStoreService,
    private readonly config: ConfigService,
  ) {}

  async runCleanup(): Promise<PositionCheckCleanupSummary> {
    const oldRecords = await this.resultRepo.find({
      where: { checkedAt: LessThan(this.thresholdDate()) },
      order: { checkedAt: 'ASC' },
    });

    if (!oldRecords.length) {
      return { companiesProcessed: 0, recordsArchived: 0 };
    }

    const byCompany = new Map<string, PositionCheckResult[]>();
    for (const record of oldRecords) {
      const list = byCompany.get(record.companyId) ?? [];
      list.push(record);
      byCompany.set(record.companyId, list);
    }

    const runTimestamp = new Date();
    let companiesProcessed = 0;
    let recordsArchived = 0;

    for (const [companyId, records] of byCompany) {
      try {
        await this.archiveOneCompany(companyId, runTimestamp, records);
        companiesProcessed += 1;
        recordsArchived += records.length;
      } catch (err) {
        // Партиальный успех — сбой архивации одной компании (сеть/MinIO) не
        // должен блокировать очистку остальных, тот же принцип, что в
        // batch-фичах api-gateway (competitor-analysis/brand,
        // position-check/brand).
        this.logger.error(
          `Не удалось архивировать историю компании ${companyId}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }

    return { companiesProcessed, recordsArchived };
  }

  private async archiveOneCompany(
    companyId: string,
    runTimestamp: Date,
    records: PositionCheckResult[],
  ): Promise<void> {
    const archived: ArchivedPositionCheckRecord[] = records.map((r) => ({
      id: r.id,
      companyId: r.companyId,
      keyword: r.keyword,
      source: r.source,
      provider: r.provider,
      position: r.position,
      checkedAt: r.checkedAt.toISOString(),
    }));

    // Порядок важен: сначала подтверждённая загрузка в MinIO, потом удаление
    // из Postgres — если сначала удалить, а загрузка упадёт, данные потеряны
    // безвозвратно; в обратном порядке возможный сбой на удалении оставляет
    // дубликат в MinIO, не потерю (см. Decision Document плана).
    await this.archiveStore.putArchive(companyId, runTimestamp, archived);
    await this.resultRepo.delete(records.map((r) => r.id));
  }

  private thresholdDate(): Date {
    const configured = Number(
      this.config.get<string>('POSITION_CHECK_RETENTION_DAYS'),
    );
    const retentionDays =
      Number.isFinite(configured) && configured > 0
        ? configured
        : DEFAULT_RETENTION_DAYS;

    const threshold = new Date();
    threshold.setDate(threshold.getDate() - retentionDays);
    return threshold;
  }
}

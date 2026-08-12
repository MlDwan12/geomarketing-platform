import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { Patterns } from '@geo/contracts';
import { TrackedKeywordService } from './services/tracked-keyword.service';
import {
  PositionCheckResultInput,
  PositionCheckResultService,
} from './services/position-check-result.service';
import { PositionCheckCleanupService } from './services/position-check-cleanup.service';

@Controller()
export class PositionCheckController {
  constructor(
    private readonly keywords: TrackedKeywordService,
    private readonly results: PositionCheckResultService,
    private readonly cleanup: PositionCheckCleanupService,
  ) {}

  @MessagePattern(Patterns.POSITION_KEYWORDS_ADD)
  addKeyword(
    @Payload()
    {
      companyId,
      brandId,
      userId,
      keyword,
    }: {
      companyId: string;
      brandId: string;
      userId: string;
      keyword: string;
    },
  ) {
    return this.keywords.add(companyId, brandId, userId, keyword);
  }

  @MessagePattern(Patterns.POSITION_KEYWORDS_REMOVE)
  removeKeyword(
    @Payload()
    {
      companyId,
      brandId,
      userId,
      keyword,
    }: {
      companyId: string;
      brandId: string;
      userId: string;
      keyword: string;
    },
  ) {
    return this.keywords.remove(companyId, brandId, userId, keyword);
  }

  @MessagePattern(Patterns.POSITION_KEYWORDS_LIST)
  listKeywords(
    @Payload()
    {
      companyId,
      brandId,
      userId,
    }: {
      companyId: string;
      brandId: string;
      userId: string;
    },
  ) {
    return this.keywords.listForCompany(companyId, brandId, userId);
  }

  @MessagePattern(Patterns.POSITION_CHECK_SAVE)
  saveResults(
    @Payload()
    {
      companyId,
      brandId,
      userId,
      results,
    }: {
      companyId: string;
      brandId: string;
      userId: string;
      results: PositionCheckResultInput[];
    },
  ) {
    return this.results.save(companyId, brandId, userId, results);
  }

  @MessagePattern(Patterns.POSITION_CHECK_HISTORY)
  history(
    @Payload()
    {
      companyId,
      brandId,
      userId,
      keyword,
    }: {
      companyId: string;
      brandId: string;
      userId: string;
      keyword?: string;
    },
  ) {
    return this.results.history(companyId, brandId, userId, keyword);
  }

  @MessagePattern(Patterns.POSITION_CHECK_ARCHIVE_LIST)
  archiveList(
    @Payload()
    {
      companyId,
      brandId,
      userId,
      keyword,
    }: {
      companyId: string;
      brandId: string;
      userId: string;
      keyword?: string;
    },
  ) {
    return this.results.archiveHistory(companyId, brandId, userId, keyword);
  }

  // Retention — см. docs/refactor-plans/position-checker-retention.md,
  // коммит 4. Глобальная операция над всеми брендами, без companyId/brandId/
  // userId в payload — вызывается либо вручную через api-gateway
  // (POST /position-check/cleanup, InternalTokenGuard), либо из @Cron()
  // (PositionCheckCleanupScheduler, тот же PositionCheckCleanupService.runCleanup()
  // напрямую, без RMQ-круга).
  @MessagePattern(Patterns.POSITION_CHECK_CLEANUP_RUN)
  cleanupRun() {
    return this.cleanup.runCleanup();
  }
}

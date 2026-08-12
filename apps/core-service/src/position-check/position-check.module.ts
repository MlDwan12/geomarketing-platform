import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TrackedKeyword } from './entities/tracked-keyword.entity';
import { PositionCheckResult } from './entities/position-check-result.entity';
import { PositionCheckController } from './position-check.controller';
import { TrackedKeywordService } from './services/tracked-keyword.service';
import { PositionCheckResultService } from './services/position-check-result.service';
import { PositionCheckArchiveStoreService } from './archive/position-check-archive-store.service';
import { s3ClientProvider } from './archive/s3-client.provider';
import { PositionCheckCleanupService } from './services/position-check-cleanup.service';
import { PositionCheckCleanupScheduler } from './services/position-check-cleanup.scheduler';
import { CompanyModule } from '../company/company.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([TrackedKeyword, PositionCheckResult]),
    CompanyModule,
  ],
  controllers: [PositionCheckController],
  providers: [
    TrackedKeywordService,
    PositionCheckResultService,
    s3ClientProvider,
    PositionCheckArchiveStoreService,
    PositionCheckCleanupService,
    PositionCheckCleanupScheduler,
  ],
})
export class PositionCheckModule {}

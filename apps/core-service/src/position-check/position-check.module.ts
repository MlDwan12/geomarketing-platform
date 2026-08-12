import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TrackedKeyword } from './entities/tracked-keyword.entity';
import { PositionCheckController } from './position-check.controller';
import { TrackedKeywordService } from './services/tracked-keyword.service';
import { CompanyModule } from '../company/company.module';

@Module({
  imports: [TypeOrmModule.forFeature([TrackedKeyword]), CompanyModule],
  controllers: [PositionCheckController],
  providers: [TrackedKeywordService],
})
export class PositionCheckModule {}

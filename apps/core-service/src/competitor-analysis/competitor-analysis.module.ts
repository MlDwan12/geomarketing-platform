import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CompetitorAnalysisReport } from './entities/competitor-analysis-report.entity';
import { CompetitorAnalysisController } from './competitor-analysis.controller';
import { CompetitorAnalysisReportService } from './services/competitor-analysis-report.service';
import { CompanyModule } from '../company/company.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([CompetitorAnalysisReport]),
    CompanyModule,
  ],
  controllers: [CompetitorAnalysisController],
  providers: [CompetitorAnalysisReportService],
})
export class CompetitorAnalysisModule {}

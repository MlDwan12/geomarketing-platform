import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { Patterns } from '@geo/contracts';
import { CompetitorAnalysisReportService } from './services/competitor-analysis-report.service';

@Controller()
export class CompetitorAnalysisController {
  constructor(
    private readonly reportService: CompetitorAnalysisReportService,
  ) {}

  @MessagePattern(Patterns.COMPETITOR_ANALYSIS_SAVE)
  save(
    @Payload()
    dto: {
      companyId: string;
      brandId: string;
      userId: string;
      competitors: unknown[];
      cardComparison: Record<string, unknown>;
      ratingComparison: Record<string, unknown>;
      textAnalysis?: Record<string, unknown> | null;
    },
  ) {
    return this.reportService.save(dto);
  }

  @MessagePattern(Patterns.COMPETITOR_ANALYSIS_GET_LATEST)
  getLatest(
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
    return this.reportService.getLatest(companyId, brandId, userId);
  }

  @MessagePattern(Patterns.COMPETITOR_ANALYSIS_LIST_HISTORY)
  listHistory(
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
    return this.reportService.listHistory(companyId, brandId, userId);
  }
}

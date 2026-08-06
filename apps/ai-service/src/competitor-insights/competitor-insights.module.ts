import { Module } from '@nestjs/common';
import { CompetitorInsightsController } from './competitor-insights.controller';
import { CompetitorInsightsService } from './competitor-insights.service';
import { DeterministicInsightsGenerator } from './deterministic-insights-generator';

@Module({
  controllers: [CompetitorInsightsController],
  providers: [CompetitorInsightsService, DeterministicInsightsGenerator],
})
export class CompetitorInsightsModule {}

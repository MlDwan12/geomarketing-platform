import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { Patterns } from '@geo/contracts';
import { CompetitorInsightsService } from './competitor-insights.service';
import { CompetitorProfile, OwnCompanyProfile } from './types';

@Controller()
export class CompetitorInsightsController {
  constructor(private readonly insightsService: CompetitorInsightsService) {}

  @MessagePattern(Patterns.AI_COMPETITOR_ANALYSIS_GENERATE)
  generate(
    @Payload()
    {
      own,
      competitors,
      ownReviews,
    }: {
      own: OwnCompanyProfile;
      competitors: CompetitorProfile[];
      ownReviews: string[];
    },
  ) {
    return this.insightsService.generate(own, competitors, ownReviews);
  }
}

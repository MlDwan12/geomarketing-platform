import { Module } from '@nestjs/common';
import { AiServiceController } from './ai-service.controller';
import { AiServiceService } from './ai-service.service';
import { AppConfigModule } from '@geo/config';
import { CompetitorInsightsModule } from './competitor-insights/competitor-insights.module';

@Module({
  imports: [AppConfigModule, CompetitorInsightsModule],
  controllers: [AiServiceController],
  providers: [AiServiceService],
})
export class AiServiceModule {}

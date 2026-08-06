import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { Queues } from '@geo/contracts';
import { CompetitorAnalysisController } from './competitor-analysis.controller';
import { CompetitorAnalysisOrchestratorService } from './competitor-analysis-orchestrator.service';
import { CompetitorReviewsFetcherService } from './competitor-reviews-fetcher.service';

@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: 'CORE_SERVICE',
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (configService: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [configService.get<string>('RABBITMQ_URL')!],
            queue: Queues.CORE,
            queueOptions: { durable: true },
          },
        }),
      },
      {
        name: 'INTEGRATION_SERVICE',
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (configService: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [configService.get<string>('RABBITMQ_URL')!],
            queue: Queues.INTEGRATION,
            queueOptions: { durable: true },
          },
        }),
      },
      {
        name: 'AI_SERVICE',
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (configService: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [configService.get<string>('RABBITMQ_URL')!],
            queue: Queues.AI,
            queueOptions: { durable: true },
          },
        }),
      },
    ]),
  ],
  controllers: [CompetitorAnalysisController],
  providers: [
    CompetitorAnalysisOrchestratorService,
    CompetitorReviewsFetcherService,
  ],
})
export class CompetitorAnalysisModule {}

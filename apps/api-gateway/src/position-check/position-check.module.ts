import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { Queues } from '@geo/contracts';
import { PositionCheckController } from './position-check.controller';
import { PositionCheckRunController } from './position-check-run.controller';
import { PositionCheckBrandController } from './position-check-brand.controller';
import { PositionCheckOrchestratorService } from './position-check-orchestrator.service';

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
    ]),
  ],
  controllers: [
    PositionCheckController,
    PositionCheckRunController,
    PositionCheckBrandController,
  ],
  providers: [PositionCheckOrchestratorService],
})
export class PositionCheckModule {}

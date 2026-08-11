import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { Queues } from '@geo/contracts';
import { ReviewsController } from './reviews.controller';

@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: 'REVIEW_SERVICE',
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (configService: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [configService.get<string>('RABBITMQ_URL')!],
            queue: Queues.REVIEW,
            queueOptions: { durable: true },
          },
        }),
      },
    ]),
  ],
  controllers: [ReviewsController],
})
export class ReviewsModule {}

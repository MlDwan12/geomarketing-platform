import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { Queues } from '@geo/contracts';
import { ReviewServiceController } from './review-service.controller';
import { ReviewServiceService } from './review-service.service';
import { AppConfigModule } from '@geo/config';
import { MapParserClientService } from './map-parser-client/map-parser-client.service';
import { ReviewsController } from './reviews/reviews.controller';
import { ReviewRefreshService } from './reviews/review-refresh.service';
import { ReviewListService } from './reviews/review-list.service';

@Module({
  imports: [
    AppConfigModule,
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
    ]),
  ],
  controllers: [ReviewServiceController, ReviewsController],
  providers: [
    ReviewServiceService,
    MapParserClientService,
    ReviewRefreshService,
    ReviewListService,
  ],
})
export class ReviewServiceModule {}

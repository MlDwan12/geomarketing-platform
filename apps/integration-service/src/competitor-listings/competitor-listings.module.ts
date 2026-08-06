import { Module } from '@nestjs/common';
import { TwoGisModule } from '../two-gis/two-gis.module';
import { YandexModule } from '../yandex/yandex.module';
import { CompetitorListingsController } from './competitor-listings.controller';
import { CompetitorListingsService } from './competitor-listings.service';

@Module({
  imports: [TwoGisModule, YandexModule],
  controllers: [CompetitorListingsController],
  providers: [CompetitorListingsService],
})
export class CompetitorListingsModule {}

import { Module } from '@nestjs/common';
import { TwoGisModule } from '../two-gis/two-gis.module';
import { YandexModule } from '../yandex/yandex.module';
import { PlacesSearchController } from './places-search.controller';
import { PlacesSearchService } from './places-search.service';

@Module({
  imports: [TwoGisModule, YandexModule],
  controllers: [PlacesSearchController],
  providers: [PlacesSearchService],
})
export class PlacesSearchModule {}

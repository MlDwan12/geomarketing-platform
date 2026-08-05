import { Module } from '@nestjs/common';
import { TwoGisModule } from '../two-gis/two-gis.module';
import { YandexModule } from '../yandex/yandex.module';
import { MapVisibilityController } from './map-visibility.controller';
import { MapVisibilityService } from './map-visibility.service';

@Module({
  imports: [TwoGisModule, YandexModule],
  controllers: [MapVisibilityController],
  providers: [MapVisibilityService],
})
export class MapVisibilityModule {}

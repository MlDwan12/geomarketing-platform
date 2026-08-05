import { Module } from '@nestjs/common';
import { IntegrationServiceController } from './integration-service.controller';
import { IntegrationServiceService } from './integration-service.service';
import { AppConfigModule } from '@geo/config';
import { TwoGisModule } from './two-gis/two-gis.module';
import { YandexModule } from './yandex/yandex.module';
import { PlacesSearchModule } from './places-search/places-search.module';
import { MapVisibilityModule } from './map-visibility/map-visibility.module';

@Module({
  imports: [
    AppConfigModule,
    TwoGisModule,
    YandexModule,
    PlacesSearchModule,
    MapVisibilityModule,
  ],
  controllers: [IntegrationServiceController],
  providers: [IntegrationServiceService],
})
export class IntegrationServiceModule {}

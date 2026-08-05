import { Module } from '@nestjs/common';
import { TwoGisController } from './two-gis.controller';
import { TwoGisPlacesService } from './two-gis-places.service';

@Module({
  controllers: [TwoGisController],
  providers: [TwoGisPlacesService],
  exports: [TwoGisPlacesService],
})
export class TwoGisModule {}

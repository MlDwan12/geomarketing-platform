import { Module } from '@nestjs/common';
import { TwoGisModule } from '../two-gis/two-gis.module';
import { YandexModule } from '../yandex/yandex.module';
import { PositionCheckController } from './position-check.controller';
import { PositionCheckService } from './position-check.service';

@Module({
  imports: [TwoGisModule, YandexModule],
  controllers: [PositionCheckController],
  providers: [PositionCheckService],
})
export class PositionCheckModule {}

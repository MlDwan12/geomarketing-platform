import { Module } from '@nestjs/common';
import { YandexController } from './yandex.controller';
import { YandexPlacesService } from './yandex-places.service';

@Module({
  controllers: [YandexController],
  providers: [YandexPlacesService],
})
export class YandexModule {}

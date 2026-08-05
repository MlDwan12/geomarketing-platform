import { Controller } from '@nestjs/common';
import { MessagePattern, Payload, RpcException } from '@nestjs/microservices';
import { Patterns } from '@geo/contracts';
import { YandexPlacesService } from './yandex-places.service';
import type { SearchPlacesParams } from './yandex-places.service';

@Controller()
export class YandexController {
  constructor(private readonly places: YandexPlacesService) {}

  @MessagePattern(Patterns.YANDEX_PLACES_SEARCH)
  searchPlaces(@Payload() payload: SearchPlacesParams) {
    if (!payload.query?.trim()) {
      throw new RpcException({ status: 400, message: 'query is required' });
    }

    return this.places.searchPlaces(payload);
  }
}

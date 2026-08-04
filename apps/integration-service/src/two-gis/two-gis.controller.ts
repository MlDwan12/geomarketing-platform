import { Controller } from '@nestjs/common';
import { MessagePattern, Payload, RpcException } from '@nestjs/microservices';
import { Patterns } from '@geo/contracts';
import { TwoGisPlacesService } from './two-gis-places.service';
import type { SearchPlacesParams } from './two-gis-places.service';

@Controller()
export class TwoGisController {
  constructor(private readonly places: TwoGisPlacesService) {}

  @MessagePattern(Patterns.TWOGIS_PLACES_SEARCH)
  searchPlaces(@Payload() payload: SearchPlacesParams) {
    if (!payload.query?.trim()) {
      throw new RpcException({ status: 400, message: 'query is required' });
    }

    return this.places.searchPlaces(payload);
  }
}

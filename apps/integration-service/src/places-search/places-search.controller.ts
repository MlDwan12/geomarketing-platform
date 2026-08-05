import { Controller } from '@nestjs/common';
import { MessagePattern, Payload, RpcException } from '@nestjs/microservices';
import { Patterns } from '@geo/contracts';
import { PlacesSearchService } from './places-search.service';
import type { SearchAllPlacesParams } from './places-search.service';

@Controller()
export class PlacesSearchController {
  constructor(private readonly search: PlacesSearchService) {}

  @MessagePattern(Patterns.PLACES_SEARCH)
  searchAll(@Payload() payload: SearchAllPlacesParams) {
    if (!payload.query?.trim()) {
      throw new RpcException({ status: 400, message: 'query is required' });
    }

    return this.search.search(payload);
  }
}

import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { Patterns } from '@geo/contracts';
import { MapVisibilityService } from './map-visibility.service';
import type { CompanyRef } from './visibility-match';

@Controller()
export class MapVisibilityController {
  constructor(private readonly service: MapVisibilityService) {}

  @MessagePattern(Patterns.MAP_VISIBILITY_CHECK)
  checkVisibility(@Payload() payload: { companies: CompanyRef[] }) {
    return this.service.checkVisibility(payload.companies);
  }
}

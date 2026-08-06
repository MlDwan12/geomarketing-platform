import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { Patterns } from '@geo/contracts';
import { CompetitorListingsService } from './competitor-listings.service';
import { CompanyRef } from '../map-visibility/visibility-match';

@Controller()
export class CompetitorListingsController {
  constructor(private readonly listingsService: CompetitorListingsService) {}

  @MessagePattern(Patterns.COMPETITOR_LISTINGS_FIND)
  findCompetitors(@Payload() { company }: { company: CompanyRef }) {
    return this.listingsService.findCompetitors(company);
  }
}

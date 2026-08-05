import { Controller, Get, Inject, Query, UseGuards } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { Patterns } from '@geo/contracts';
import { SessionGuard } from '../../auth/guards/session.guard';
import { sendRpc } from '../../common/rpc';
import { SearchAllPlacesDto } from './search-all-places.dto';

@Controller('integrations/places')
@UseGuards(SessionGuard)
export class PlacesSearchController {
  constructor(
    @Inject('INTEGRATION_SERVICE')
    private readonly integrationClient: ClientProxy,
  ) {}

  // GET /integrations/places/search?q=...&location=lon,lat
  // Объединённый поиск по 2ГИС + Яндекс с нормализацией и дедупликацией
  // результатов — без создания компаний.
  @Get('search')
  searchAll(@Query() dto: SearchAllPlacesDto) {
    return sendRpc(this.integrationClient, Patterns.PLACES_SEARCH, {
      query: dto.q,
      location: dto.location,
    });
  }
}

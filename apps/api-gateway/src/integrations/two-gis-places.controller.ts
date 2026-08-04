import { Controller, Get, Inject, Query, UseGuards } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { Patterns } from '@geo/contracts';
import { SessionGuard } from '../auth/guards/session.guard';
import { sendRpc } from '../common/rpc';
import { SearchPlacesDto } from './search-places.dto';

@Controller('integrations/2gis')
@UseGuards(SessionGuard)
export class TwoGisPlacesController {
  constructor(
    @Inject('INTEGRATION_SERVICE')
    private readonly integrationClient: ClientProxy,
  ) {}

  // GET /integrations/2gis/places?q=...&location=lon,lat&regionId=...&page=&pageSize=&fields=point,contact_groups
  // Только поиск/превью по каталогу 2ГИС (Places API) — без создания компаний.
  @Get('places')
  searchPlaces(@Query() dto: SearchPlacesDto) {
    return sendRpc(this.integrationClient, Patterns.TWOGIS_PLACES_SEARCH, {
      query: dto.q,
      location: dto.location,
      regionId: dto.regionId,
      page: dto.page,
      pageSize: dto.pageSize,
      fields: dto.fields,
    });
  }
}

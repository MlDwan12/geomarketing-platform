import { Controller, Get, Inject, Query, UseGuards } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Patterns } from '@geo/contracts';
import { SessionGuard } from '../../auth/guards/session.guard';
import { sendRpc } from '../../common/rpc';
import { SearchPlacesDto } from './search-places.dto';
import { TwoGisSearchResponseDto } from './two-gis-place-item.dto';

@ApiTags('integrations')
@ApiCookieAuth()
@Controller('integrations/2gis')
@UseGuards(SessionGuard)
export class TwoGisPlacesController {
  constructor(
    @Inject('INTEGRATION_SERVICE')
    private readonly integrationClient: ClientProxy,
  ) {}

  // GET /integrations/2gis/places?q=...&location=lon,lat&regionId=...&page=&pageSize=&fields=point,contact_groups
  // Только поиск/превью по каталогу 2ГИС (Places API) — без создания компаний.
  @ApiOperation({
    summary: 'Поиск организаций в каталоге 2ГИС (Places API)',
    description:
      'Только поиск/превью — не создаёт компаний. Официальный публичный Places API 2ГИС (не личный кабинет).',
  })
  @ApiResponse({ status: 200, type: TwoGisSearchResponseDto })
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

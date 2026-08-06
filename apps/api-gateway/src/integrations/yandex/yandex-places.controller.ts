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
import { SearchYandexPlacesDto } from './search-yandex-places.dto';
import { YandexSearchResponseDto } from './yandex-org-feature.dto';

@ApiTags('integrations')
@ApiCookieAuth()
@Controller('integrations/yandex')
@UseGuards(SessionGuard)
export class YandexPlacesController {
  constructor(
    @Inject('INTEGRATION_SERVICE')
    private readonly integrationClient: ClientProxy,
  ) {}

  // GET /integrations/yandex/places?q=...&ll=lon,lat&spn=...&results=&skip=
  // Только поиск/превью по Яндекс Geosearch API — без создания компаний.
  @ApiOperation({
    summary: 'Поиск организаций через Яндекс Geosearch API',
    description:
      'Только поиск/превью — не создаёт компаний. Это read-only API (запись карточки в Яндекс не поддерживается — см. roadmap).',
  })
  @ApiResponse({ status: 200, type: YandexSearchResponseDto })
  @Get('places')
  searchPlaces(@Query() dto: SearchYandexPlacesDto) {
    return sendRpc(this.integrationClient, Patterns.YANDEX_PLACES_SEARCH, {
      query: dto.q,
      ll: dto.ll,
      spn: dto.spn,
      results: dto.results,
      skip: dto.skip,
    });
  }
}

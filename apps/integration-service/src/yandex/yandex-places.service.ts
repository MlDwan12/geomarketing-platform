import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RpcException } from '@nestjs/microservices';

// Форма ответа search-maps.yandex.ru/v1 (GeoJSON) — поля как в API Яндекс
// Карт, без переименования (тот же подход, что и в TwoGisPlaceItem).
// CompanyMetaData присутствует только при type=biz (поиск организаций,
// не топонимов) — здесь именно этот тип и используется.
export interface YandexOrgFeature {
  type: 'Feature';
  geometry?: { type: 'Point'; coordinates: [number, number] };
  properties?: {
    name?: string;
    description?: string;
    boundedBy?: number[][];
    CompanyMetaData?: {
      id?: string;
      name?: string;
      address?: string;
      Address?: {
        formatted?: string;
        country_code?: string;
        postal_code?: string;
        Components?: { kind?: string; name?: string }[];
      };
      url?: string;
      Categories?: { class?: string; name?: string }[];
      Phones?: { type?: string; formatted?: string }[];
      Hours?: { text?: string; Availabilities?: unknown[] };
    };
  };
}

interface YandexGeosearchResponse {
  type?: string;
  properties?: {
    ResponseMetaData?: {
      SearchResponse?: { found?: number };
    };
  };
  features?: YandexOrgFeature[];
}

export interface SearchPlacesParams {
  query: string;
  ll?: string; // "lon,lat" — центр поиска
  spn?: string; // "lon_delta,lat_delta" — размер области поиска
  results?: number; // макс. 50, по умолчанию 10
  skip?: number; // пагинация: смещение, кратное results
  lang?: string;
}

export interface SearchPlacesResult {
  items: YandexOrgFeature[];
  total: number;
}

@Injectable()
export class YandexPlacesService {
  private readonly apiBase = 'https://search-maps.yandex.ru/v1/';

  constructor(private readonly config: ConfigService) {}

  async searchPlaces(params: SearchPlacesParams): Promise<SearchPlacesResult> {
    const url = new URL(this.apiBase);
    url.searchParams.set('text', params.query);
    url.searchParams.set(
      'apikey',
      this.config.getOrThrow<string>('YANDEX_GEOSEARCH_API_KEY'),
    );
    url.searchParams.set('lang', params.lang ?? 'ru_RU');
    url.searchParams.set('type', 'biz');
    if (params.ll) url.searchParams.set('ll', params.ll);
    if (params.spn) url.searchParams.set('spn', params.spn);
    url.searchParams.set('results', String(params.results ?? 10));
    if (params.skip !== undefined) {
      url.searchParams.set('skip', String(params.skip));
    }

    const res = await fetch(url);
    const text = await res.text();

    if (!res.ok) {
      throw new RpcException({
        status: res.status,
        message: `Yandex geosearch error ${res.status}: ${text.slice(0, 300)}`,
      });
    }

    const data = JSON.parse(text) as YandexGeosearchResponse;

    return {
      items: data.features ?? [],
      total:
        data.properties?.ResponseMetaData?.SearchResponse?.found ??
        data.features?.length ??
        0,
    };
  }
}

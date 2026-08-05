import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RpcException } from '@nestjs/microservices';

// Форма ответа catalog.api.2gis.com/3.0/items — поля как в API 2ГИС,
// без переименования (см. TwoGisCatalogItem в api-gateway/import — тот же
// подход: типизируем внешний контракт как есть, а не мапим в свои имена).
// point/contact_groups/schedule/reviews/photos/adm_div/description отдаёт
// 2ГИС, только если явно запрошены через fields (см. TwoGisSearchField).
export interface TwoGisPlaceItem {
  id: string;
  name?: string;
  type?: string;
  address_name?: string;
  full_address_name?: string;
  address_comment?: string;
  point?: { lat: number; lon: number };
  rubrics?: { id: string; name: string; alias?: string }[];
  region_id?: string;
  contact_groups?: {
    contacts?: { type: string; value: string; comment?: string }[];
  }[];
  schedule?: Record<string, unknown>;
  reviews?: { general_rating?: number; general_review_count?: number };
  photos?: { type?: string; url?: string }[];
  adm_div?: { type?: string; name?: string; id?: string }[];
  description?: string;
}

// Значения без префикса "items." — сервис сам его добавляет при сборке
// запроса (2ГИС требует именно items.point, items.contact_groups и т.д.).
export type TwoGisSearchField =
  | 'point'
  | 'contact_groups'
  | 'schedule'
  | 'reviews'
  | 'photos'
  | 'adm_div'
  | 'rubrics'
  | 'description';

interface TwoGisItemsResponse {
  // 2ГИС может вернуть ошибку с HTTP 200 — код ошибки и сообщение сидят
  // только в meta, а не в статусе ответа (проверено живым запросом:
  // невалидный/неактивный key даёт HTTP 200 + meta.code:403). Поэтому
  // meta.code проверяется отдельно от res.ok.
  meta?: { code?: number; error?: { message?: string; type?: string } };
  result?: {
    items?: TwoGisPlaceItem[];
    total?: number;
  };
}

export interface SearchPlacesParams {
  query: string;
  location?: string; // "lon,lat"
  regionId?: number;
  page?: number;
  pageSize?: number;
  fields?: TwoGisSearchField[];
}

export interface SearchPlacesResult {
  items: TwoGisPlaceItem[];
  total: number;
}

@Injectable()
export class TwoGisPlacesService {
  private readonly apiBase = 'https://catalog.api.2gis.com/3.0/items';

  constructor(private readonly config: ConfigService) {}

  async searchPlaces(params: SearchPlacesParams): Promise<SearchPlacesResult> {
    const url = new URL(this.apiBase);
    url.searchParams.set('q', params.query);
    url.searchParams.set(
      'key',
      this.config.getOrThrow<string>('TWO_GIS_API_KEY'),
    );
    url.searchParams.set('locale', 'ru_RU');
    if (params.location) url.searchParams.set('location', params.location);
    if (params.regionId !== undefined) {
      url.searchParams.set('region_id', String(params.regionId));
    }
    url.searchParams.set('page', String(params.page ?? 1));
    // 2ГИС реально ограничивает page_size значением 1-10 (проверено живым
    // запросом: page_size=20 → "Length of parameter 'page_size' should be
    // from 1 to 10"), несмотря на то, что раньше в коде был дефолт 20.
    url.searchParams.set('page_size', String(params.pageSize ?? 10));
    if (params.fields?.length) {
      url.searchParams.set(
        'fields',
        params.fields.map((f) => `items.${f}`).join(','),
      );
    }

    const res = await fetch(url);
    const text = await res.text();

    if (!res.ok) {
      throw new RpcException({
        status: res.status,
        message: `2GIS places search error ${res.status}: ${text.slice(0, 300)}`,
      });
    }

    const data = JSON.parse(text) as TwoGisItemsResponse;

    if (data.meta?.code !== undefined && data.meta.code !== 200) {
      throw new RpcException({
        status: data.meta.code,
        message:
          data.meta.error?.message ??
          `2GIS places search error: ${text.slice(0, 300)}`,
      });
    }

    return {
      items: data.result?.items ?? [],
      total: data.result?.total ?? 0,
    };
  }
}

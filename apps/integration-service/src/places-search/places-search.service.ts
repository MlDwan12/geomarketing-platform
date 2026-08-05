import { Injectable } from '@nestjs/common';
import { TwoGisPlacesService } from '../two-gis/two-gis-places.service';
import { YandexPlacesService } from '../yandex/yandex-places.service';
import {
  dedupePlaces,
  normalizeTwoGisItem,
  normalizeYandexItem,
  NormalizedPlace,
  PlaceProvider,
} from './normalize';

export interface SearchAllPlacesParams {
  query: string;
  location?: string; // "lon,lat" — общий формат для обоих провайдеров
}

export interface SearchAllPlacesResult {
  items: NormalizedPlace[];
  total: number;
  // Провайдеры, которые ответили ошибкой (невалидный ключ, rate limit,
  // отсутствие обязательных для конкретного провайдера параметров и т.п.) —
  // частичный успех: остальные результаты всё равно возвращаются.
  failedSources: PlaceProvider[];
}

@Injectable()
export class PlacesSearchService {
  constructor(
    private readonly twoGis: TwoGisPlacesService,
    private readonly yandex: YandexPlacesService,
  ) {}

  async search(params: SearchAllPlacesParams): Promise<SearchAllPlacesResult> {
    const [twoGisResult, yandexResult] = await Promise.allSettled([
      this.twoGis.searchPlaces({
        query: params.query,
        location: params.location,
        fields: ['point', 'contact_groups', 'rubrics'],
      }),
      this.yandex.searchPlaces({
        query: params.query,
        ll: params.location,
      }),
    ]);

    const failedSources: PlaceProvider[] = [];
    const normalized: NormalizedPlace[] = [];

    if (twoGisResult.status === 'fulfilled') {
      normalized.push(...twoGisResult.value.items.map(normalizeTwoGisItem));
    } else {
      failedSources.push('2gis');
    }

    if (yandexResult.status === 'fulfilled') {
      normalized.push(...yandexResult.value.items.map(normalizeYandexItem));
    } else {
      failedSources.push('yandex');
    }

    const items = dedupePlaces(normalized);

    return { items, total: items.length, failedSources };
  }
}

import { Injectable } from '@nestjs/common';
import { TwoGisPlacesService } from '../two-gis/two-gis-places.service';
import { YandexPlacesService } from '../yandex/yandex-places.service';
import { NormalizedPlace } from '../places-search/normalize';
import { findOwnListing, MapProviderKey } from '../common/own-listing-finder';
import { CompanyRef, MatchConfidence } from './visibility-match';

export type { MapProviderKey };

export interface ProviderVisibility {
  visible: boolean;
  matchedItem?: NormalizedPlace;
  confidence?: MatchConfidence;
  // Поиск по этому провайдеру для этой компании упал (невалидный ключ,
  // rate limit, 2ГИС требует location, которого нет у старых Company без
  // coordinates) — не путать с visible: false (там поиск прошёл, просто
  // совпадений не нашлось).
  error?: string;
}

export interface MapVisibilityResult {
  companyId: string;
  byProvider: Record<MapProviderKey, ProviderVisibility>;
}

// Сеть в 50 точек × 2 провайдера = 100 внешних запросов за один аудит —
// ограничиваем параллелизм, чтобы не улететь в rate limit.
const CONCURRENCY = 5;

@Injectable()
export class MapVisibilityService {
  constructor(
    private readonly twoGis: TwoGisPlacesService,
    private readonly yandex: YandexPlacesService,
  ) {}

  async checkVisibility(
    companies: CompanyRef[],
  ): Promise<MapVisibilityResult[]> {
    const results: MapVisibilityResult[] = [];

    for (let i = 0; i < companies.length; i += CONCURRENCY) {
      const batch = companies.slice(i, i + CONCURRENCY);
      const batchResults = await Promise.all(
        batch.map((company) => this.checkOne(company)),
      );
      results.push(...batchResults);
    }

    return results;
  }

  private async checkOne(company: CompanyRef): Promise<MapVisibilityResult> {
    const [twoGis, yandex] = await Promise.all([
      this.checkProvider(company, '2gis'),
      this.checkProvider(company, 'yandex'),
    ]);

    return { companyId: company.id, byProvider: { '2gis': twoGis, yandex } };
  }

  private async checkProvider(
    company: CompanyRef,
    provider: MapProviderKey,
  ): Promise<ProviderVisibility> {
    try {
      const match = await findOwnListing(company, provider, {
        twoGis: this.twoGis,
        yandex: this.yandex,
      });

      if (match) {
        return {
          visible: true,
          matchedItem: match.matchedItem,
          confidence: match.confidence,
        };
      }

      return { visible: false };
    } catch (e) {
      return {
        visible: false,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }
}

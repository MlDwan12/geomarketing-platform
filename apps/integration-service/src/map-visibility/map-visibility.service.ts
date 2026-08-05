import { Injectable } from '@nestjs/common';
import { TwoGisPlacesService } from '../two-gis/two-gis-places.service';
import { YandexPlacesService } from '../yandex/yandex-places.service';
import {
  normalizeTwoGisItem,
  normalizeYandexItem,
  NormalizedPlace,
} from '../places-search/normalize';
import {
  CompanyRef,
  matchesCompany,
  MatchConfidence,
} from './visibility-match';

export type MapProviderKey = '2gis' | 'yandex';

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
      const candidates = await this.searchCandidates(company, provider);

      for (const candidate of candidates) {
        const match = matchesCompany(company, candidate);
        if (match.matched) {
          return {
            visible: true,
            matchedItem: candidate,
            confidence: match.confidence,
          };
        }
      }

      return { visible: false };
    } catch (e) {
      return {
        visible: false,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }

  private async searchCandidates(
    company: CompanyRef,
    provider: MapProviderKey,
  ): Promise<NormalizedPlace[]> {
    const location = company.coordinates
      ? `${company.coordinates[0]},${company.coordinates[1]}`
      : undefined;

    if (provider === '2gis') {
      const result = await this.twoGis.searchPlaces({
        query: company.name,
        location,
        fields: ['point', 'contact_groups', 'rubrics'],
      });
      return result.items.map(normalizeTwoGisItem);
    }

    const result = await this.yandex.searchPlaces({
      query: company.name,
      ll: location,
    });
    return result.items.map(normalizeYandexItem);
  }
}

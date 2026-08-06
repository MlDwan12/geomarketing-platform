import { Injectable } from '@nestjs/common';
import { TwoGisPlacesService } from '../two-gis/two-gis-places.service';
import { YandexPlacesService } from '../yandex/yandex-places.service';
import { findOwnListing, MapProviderKey } from '../common/own-listing-finder';
import { CompanyRef } from '../map-visibility/visibility-match';
import {
  dedupePlaces,
  normalizeTwoGisItem,
  normalizeYandexItem,
  NormalizedPlace,
} from '../places-search/normalize';
import {
  CompetitorListing,
  filterByCategory,
  rankCompetitors,
} from './competitor-listing';

const CANDIDATES_PER_PROVIDER = 10;

// Поиск CompetitorListing для CompanyAnalysisReport (см.
// docs/refactor-plans/competitor-analysis-report.md, коммит 3) — без
// авторизованного доступа к аккаунту, только публичный поиск.
@Injectable()
export class CompetitorListingsService {
  constructor(
    private readonly twoGis: TwoGisPlacesService,
    private readonly yandex: YandexPlacesService,
  ) {}

  async findCompetitors(company: CompanyRef): Promise<CompetitorListing[]> {
    // Без координат Company найти конкурентов рядом невозможно — не ошибка,
    // просто пустой результат (так же, как MapVisibility фолбэкается на
    // текстовое сопоставление, но там это была проверка одной конкретной
    // карточки, а не радиус-поиск, для которого координаты обязательны).
    if (!company.coordinates) return [];

    const [twoGisCandidates, yandexCandidates] = await Promise.all([
      this.searchProviderCompetitors(company, '2gis'),
      this.searchProviderCompetitors(company, 'yandex'),
    ]);

    const merged = dedupePlaces([...twoGisCandidates, ...yandexCandidates]);
    return rankCompetitors(company, merged);
  }

  private async searchProviderCompetitors(
    company: CompanyRef,
    provider: MapProviderKey,
  ): Promise<NormalizedPlace[]> {
    try {
      const ownListing = await findOwnListing(company, provider, {
        twoGis: this.twoGis,
        yandex: this.yandex,
      });
      const category = ownListing?.matchedItem.categories?.[0];
      // Нет собственного листинга на этом провайдере или у него не известна
      // категория — не по чему искать конкурентов именно на этом провайдере
      // (категории не сопоставляются между провайдерами, см. CONTEXT.md).
      if (!category) return [];

      const location = `${company.coordinates![0]},${company.coordinates![1]}`;

      if (provider === '2gis') {
        const result = await this.twoGis.searchPlaces({
          query: category,
          location,
          pageSize: CANDIDATES_PER_PROVIDER,
          fields: ['point', 'contact_groups', 'rubrics', 'reviews'],
        });
        return filterByCategory(
          result.items.map(normalizeTwoGisItem),
          category,
        );
      }

      const result = await this.yandex.searchPlaces({
        query: category,
        ll: location,
        results: CANDIDATES_PER_PROVIDER,
      });
      return filterByCategory(result.items.map(normalizeYandexItem), category);
    } catch {
      // Партиальный успех — поиск на одном провайдере упал, второй
      // всё равно даёт результат (тот же принцип, что в PlacesSearchService).
      return [];
    }
  }
}

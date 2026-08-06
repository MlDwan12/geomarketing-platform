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
} from '../map-visibility/visibility-match';

export type MapProviderKey = '2gis' | 'yandex';

export interface OwnListingMatch {
  matchedItem: NormalizedPlace;
  confidence: MatchConfidence;
}

export interface OwnListingClients {
  twoGis: TwoGisPlacesService;
  yandex: YandexPlacesService;
}

// Найти собственный листинг Company на конкретном MapProvider публичным
// поиском (без доступа к аккаунту) — общий механизм для MapVisibility
// (используется тут же) и для поиска CompetitorListing (см.
// docs/refactor-plans/competitor-analysis-report.md, коммит 3): там нужна
// категория/рубрика СВОЕГО листинга на этом же провайдере, чтобы искать рядом
// места той же категории на этом же провайдере.
export async function findOwnListing(
  company: CompanyRef,
  provider: MapProviderKey,
  clients: OwnListingClients,
): Promise<OwnListingMatch | null> {
  const candidates = await searchCandidates(company, provider, clients);

  for (const candidate of candidates) {
    const match = matchesCompany(company, candidate);
    if (match.matched) {
      return { matchedItem: candidate, confidence: match.confidence! };
    }
  }

  return null;
}

async function searchCandidates(
  company: CompanyRef,
  provider: MapProviderKey,
  clients: OwnListingClients,
): Promise<NormalizedPlace[]> {
  const location = company.coordinates
    ? `${company.coordinates[0]},${company.coordinates[1]}`
    : undefined;

  if (provider === '2gis') {
    const result = await clients.twoGis.searchPlaces({
      query: company.name,
      location,
      fields: ['point', 'contact_groups', 'rubrics'],
    });
    return result.items.map(normalizeTwoGisItem);
  }

  const result = await clients.yandex.searchPlaces({
    query: company.name,
    ll: location,
  });
  return result.items.map(normalizeYandexItem);
}

import {
  normalizeTwoGisItem,
  normalizeYandexItem,
} from '../places-search/normalize';
import { CompanyRef, matchesCompany } from '../map-visibility/visibility-match';
import {
  MapProviderKey,
  OwnListingClients,
} from '../common/own-listing-finder';

// Глубина проверки — топ-10 (решение пользователя, см.
// docs/refactor-plans/position-checker.md, Decision Document) — один запрос
// на провайдера на ключевое слово, без пагинации 2ГИС.
const TOP_N = 10;

// Позиция компании в выдаче по конкретному ключевому слову — индекс первого
// совпадения (matchesCompany, тот же механизм, что MapVisibility/
// CompetitorListings) в результатах поиска, упорядоченных платформой. Без
// координат у Company — null сразу, без похода наружу (тот же паттерн, что
// CompetitorListingsService.findCompetitors).
export async function findPosition(
  company: CompanyRef,
  keyword: string,
  provider: MapProviderKey,
  clients: OwnListingClients,
): Promise<number | null> {
  if (!company.coordinates) return null;

  const location = `${company.coordinates[0]},${company.coordinates[1]}`;

  const candidates =
    provider === '2gis'
      ? (
          await clients.twoGis.searchPlaces({
            query: keyword,
            location,
            pageSize: TOP_N,
            fields: ['point'],
          })
        ).items.map(normalizeTwoGisItem)
      : (
          await clients.yandex.searchPlaces({
            query: keyword,
            ll: location,
            results: TOP_N,
          })
        ).items.map(normalizeYandexItem);

  const index = candidates.findIndex(
    (candidate) => matchesCompany(company, candidate).matched,
  );

  return index === -1 ? null : index;
}

import { NormalizedPlace, PlaceSource } from '../places-search/normalize';
import { CompanyRef, matchesCompany } from '../map-visibility/visibility-match';
import { haversineMeters, namesLikelyMatch } from '../common/geo-match';

// Радиус и лимит зафиксированы для MVP (см. CONTEXT.md, интервью 2026-08-06) —
// без настройки пользователем, без прогрессивного расширения.
export const COMPETITOR_RADIUS_METERS = 1000;
export const MAX_COMPETITORS = 5;
const CATEGORY_SIMILARITY_THRESHOLD = 0.5;

export interface CompetitorListing {
  name: string;
  address?: string;
  coordinates?: [number, number];
  categories?: string[];
  rating?: number;
  reviewCount?: number;
  distanceMeters: number;
  sources: PlaceSource[];
}

// Кандидат считается той же категории, если хотя бы одна его категория похожа
// на категорию собственного листинга Company на этом же провайдере (см.
// docs/refactor-plans/competitor-analysis-report.md — категории сравниваются
// отдельно по MapProvider, не кросс-провайдерно).
export function filterByCategory(
  candidates: NormalizedPlace[],
  category: string,
): NormalizedPlace[] {
  return candidates.filter((c) =>
    c.categories?.some((name) =>
      namesLikelyMatch(category, name, CATEGORY_SIMILARITY_THRESHOLD),
    ),
  );
}

// Из уже отфильтрованных по категории и объединённых между провайдерами
// (dedupePlaces) кандидатов — исключает саму Company, оставляет только то,
// что в радиусе, сортирует по расстоянию и берёт top-MAX_COMPETITORS.
export function rankCompetitors(
  company: CompanyRef,
  candidates: NormalizedPlace[],
): CompetitorListing[] {
  if (!company.coordinates) return [];
  const companyCoordinates = company.coordinates;

  return candidates
    .filter((c): c is NormalizedPlace & { coordinates: [number, number] } =>
      Boolean(c.coordinates),
    )
    .filter((c) => !matchesCompany(company, c).matched)
    .map((c) => ({
      ...toCompetitorListing(c),
      distanceMeters: Math.round(
        haversineMeters(companyCoordinates, c.coordinates),
      ),
    }))
    .filter((c) => c.distanceMeters <= COMPETITOR_RADIUS_METERS)
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .slice(0, MAX_COMPETITORS);
}

function toCompetitorListing(
  place: NormalizedPlace,
): Omit<CompetitorListing, 'distanceMeters'> {
  return {
    name: place.name,
    address: place.address,
    coordinates: place.coordinates,
    categories: place.categories,
    rating: place.rating,
    reviewCount: place.reviewCount,
    sources: place.sources,
  };
}

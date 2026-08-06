import {
  CardComparisonResult,
  CompetitorProfile,
  OwnCompanyProfile,
  RatingComparisonResult,
} from './types';

// Чистые функции — без AI, полностью детерминированные и тестируемые (см.
// docs/refactor-plans/competitor-analysis-report.md, коммит 5).

export function compareCardFields(
  own: OwnCompanyProfile,
  competitors: CompetitorProfile[],
): CardComparisonResult {
  return {
    own: { hasPhone: own.hasPhone },
    competitors: competitors.map((c) => ({
      name: c.name,
      hasPhone: c.hasPhone,
    })),
  };
}

export function compareRatings(
  own: OwnCompanyProfile,
  competitors: CompetitorProfile[],
): RatingComparisonResult {
  const ratedCompetitorRatings = competitors
    .map((c) => c.rating)
    .filter((r): r is number => r !== undefined);

  const averageCompetitorRating = ratedCompetitorRatings.length
    ? ratedCompetitorRatings.reduce((sum, r) => sum + r, 0) /
      ratedCompetitorRatings.length
    : undefined;

  let ownRank: number | undefined;
  if (own.rating !== undefined) {
    const allRatings = [own.rating, ...ratedCompetitorRatings].sort(
      (a, b) => b - a,
    );
    ownRank = allRatings.indexOf(own.rating) + 1;
  }

  return {
    own: { rating: own.rating, reviewCount: own.reviewCount },
    competitors: competitors.map((c) => ({
      name: c.name,
      rating: c.rating,
      reviewCount: c.reviewCount,
    })),
    ownRank,
    averageCompetitorRating,
  };
}

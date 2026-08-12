import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface FetchedReview {
  text: string | null;
  stars: number | null;
}

// Сколько последних отзывов брать на один источник (см. CONTEXT.md,
// интервью 2026-08-06) — и на свою компанию, и на каждого конкурента.
const REVIEWS_PER_SOURCE = 50;

// Скрапинг отзывов для CompetitorAnalysisReport (см.
// docs/refactor-plans/competitor-analysis-report.md, коммит 4) — тонкий HTTP-
// клиент к map-parser, по аналогии с вызовами map-parser из
// TwoGisImportController. saveToDb: false — отзывы (и свои, и чужие) для
// этого отчёта используются одноразово для AI-анализа, не персистятся
// (см. Out of Scope плана). companyId — просто лейбл для логов на стороне
// map-parser, не должен быть реальной записью в БД (map-parser сейчас вообще
// не пишет отзывы в БД из parseReviews — upsertReviews нигде не вызывается).
//
// 2ГИС (см. docs/refactor-plans/competitor-2gis-reviews.md): URL вида
// https://2gis.ru/geo/{id} — тот же id, что уже приходит в
// CompetitorListing.sources[] для provider '2gis' (публичный каталог-поиск).
// Подтверждено живым спайком — city-agnostic, не нужен отдельный city-slug.
@Injectable()
export class CompetitorReviewsFetcherService {
  private readonly mapParserUrl: string;

  constructor(private readonly config: ConfigService) {
    this.mapParserUrl =
      this.config.get<string>('MAP_PARSER_URL') ?? 'http://geo-map-parser:3005';
  }

  async fetchYandexReviews(
    companyIdLabel: string,
    orgId: string,
  ): Promise<FetchedReview[]> {
    try {
      const res = await fetch(`${this.mapParserUrl}/parser/reviews`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Token':
            this.config.get<string>('MAP_PARSER_INTERNAL_TOKEN') ?? '',
        },
        body: JSON.stringify({
          companyId: companyIdLabel,
          orgId,
          limit: REVIEWS_PER_SOURCE,
          saveToDb: false,
        }),
      });

      if (!res.ok) return [];

      const data = (await res.json()) as {
        reviews?: { text: string | null; stars: number | null }[];
      };

      return (data.reviews ?? []).map((r) => ({
        text: r.text,
        stars: r.stars,
      }));
    } catch {
      // Скрапинг для одного источника упал — не валит весь отчёт, конкурент
      // просто останется без AI-анализа отзывов (partial success, тот же
      // принцип, что в PlacesSearchService/MapVisibilityService).
      return [];
    }
  }

  async fetchTwoGisReviews(
    companyIdLabel: string,
    branchId: string,
  ): Promise<FetchedReview[]> {
    try {
      const res = await fetch(`${this.mapParserUrl}/parser/2gis/reviews`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Token':
            this.config.get<string>('MAP_PARSER_INTERNAL_TOKEN') ?? '',
        },
        body: JSON.stringify({
          companyId: companyIdLabel,
          twoGisUrl: `https://2gis.ru/geo/${branchId}`,
          branchId,
          limit: REVIEWS_PER_SOURCE,
          saveToDb: false,
        }),
      });

      if (!res.ok) return [];

      const data = (await res.json()) as {
        reviews?: { text: string | null; stars: number | null }[];
      };

      return (data.reviews ?? []).map((r) => ({
        text: r.text,
        stars: r.stars,
      }));
    } catch {
      return [];
    }
  }
}

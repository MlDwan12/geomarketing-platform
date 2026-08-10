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
// Реализован только Яндекс: YandexParserService сам строит URL из orgId.
// 2ГИС не реализован — TwoGisParserService.parseReviews требует полный
// навигируемый twoGisUrl (page.goto), а у CompetitorListing с 2ГИС есть
// только id/branchId без city-slug, из которого собрать корректный URL.
// Не гадаем на URL без живой проверки — открытый вопрос на будущее.
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
}

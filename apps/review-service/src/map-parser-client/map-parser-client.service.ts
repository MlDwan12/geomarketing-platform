import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// Полнофидельная проекция ReviewEntity (apps/map-parser/src/reviews/entities/review.entity.ts),
// как её отдаёт GET /parser/reviews/:companyId — в отличие от урезанного FetchedReview
// в apps/api-gateway/src/competitor-analysis/competitor-reviews-fetcher.service.ts
// (там только {text, stars} для AI-анализа, без даты/автора/ответа владельца).
export type MapParserReview = {
  id: string;
  companyId: string;
  source: 'YANDEX' | 'GIS';
  externalReviewId: string;
  authorName?: string | null;
  rating?: number | null;
  text?: string | null;
  publishedAt?: string | null;
  answer?: string | null;
  answerPublishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RefreshResult = {
  success: boolean;
  reviewsCount: number;
  error?: string;
};

@Injectable()
export class MapParserClientService {
  private readonly mapParserUrl: string;
  private readonly internalToken: string;

  constructor(private readonly config: ConfigService) {
    this.mapParserUrl =
      this.config.get<string>('MAP_PARSER_URL') ?? 'http://geo-map-parser:3005';
    this.internalToken =
      this.config.get<string>('MAP_PARSER_INTERNAL_TOKEN') ?? '';
  }

  async refreshYandexReviews(
    companyId: string,
    orgId: string,
  ): Promise<RefreshResult> {
    return this.postReviews('/parser/reviews', { companyId, orgId });
  }

  async refreshTwoGisReviews(
    companyId: string,
    branchId: string,
  ): Promise<RefreshResult> {
    return this.postReviews('/parser/2gis/reviews', {
      companyId,
      twoGisUrl: `https://2gis.ru/geo/${branchId}`,
      branchId,
    });
  }

  async getStoredReviews(companyId: string): Promise<MapParserReview[]> {
    try {
      const res = await fetch(
        `${this.mapParserUrl}/parser/reviews/${encodeURIComponent(companyId)}`,
        { headers: { 'X-Internal-Token': this.internalToken } },
      );

      if (!res.ok) return [];

      return (await res.json()) as MapParserReview[];
    } catch {
      return [];
    }
  }

  private async postReviews(
    path: string,
    body: Record<string, unknown>,
  ): Promise<RefreshResult> {
    try {
      const res = await fetch(`${this.mapParserUrl}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Token': this.internalToken,
        },
        body: JSON.stringify({ ...body, saveToDb: true }),
      });

      if (!res.ok) {
        return { success: false, reviewsCount: 0, error: `HTTP ${res.status}` };
      }

      const data = (await res.json()) as {
        reviews?: unknown[];
        error?: string;
      };

      if (data.error) {
        return { success: false, reviewsCount: 0, error: data.error };
      }

      return { success: true, reviewsCount: data.reviews?.length ?? 0 };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, reviewsCount: 0, error: message };
    }
  }
}

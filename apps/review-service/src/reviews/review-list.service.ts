import { Injectable } from '@nestjs/common';
import {
  MapParserClientService,
  MapParserReview,
} from '../map-parser-client/map-parser-client.service';
import { computeAggregates, ReviewAggregates } from './review-aggregates';

export type ReviewListResult = {
  reviews: MapParserReview[];
  aggregates: ReviewAggregates;
};

@Injectable()
export class ReviewListService {
  constructor(private readonly mapParserClient: MapParserClientService) {}

  async listForCompany(companyId: string): Promise<ReviewListResult> {
    const reviews = await this.mapParserClient.getStoredReviews(companyId);

    return { reviews, aggregates: computeAggregates(reviews) };
  }
}

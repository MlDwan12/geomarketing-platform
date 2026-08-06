import { Injectable } from '@nestjs/common';
import { compareCardFields, compareRatings } from './competitor-comparison';
import { DeterministicInsightsGenerator } from './deterministic-insights-generator';
import { TextAnalysisNotImplementedError } from './text-analysis-not-implemented.error';
import {
  CardComparisonResult,
  CompetitorProfile,
  OwnCompanyProfile,
  RatingComparisonResult,
  TextAnalysisResult,
} from './types';

export interface CompetitorInsights {
  cardComparison: CardComparisonResult;
  ratingComparison: RatingComparisonResult;
  // null — AI-анализ текста отзывов ещё не реализован (см.
  // TextAnalysisNotImplementedError). Не путать с "отзывов не было" —
  // сейчас это единственная причина null.
  textAnalysis: TextAnalysisResult | null;
}

@Injectable()
export class CompetitorInsightsService {
  constructor(
    private readonly insightsGenerator: DeterministicInsightsGenerator,
  ) {}

  async generate(
    own: OwnCompanyProfile,
    competitors: CompetitorProfile[],
    ownReviews: string[],
  ): Promise<CompetitorInsights> {
    const cardComparison = compareCardFields(own, competitors);
    const ratingComparison = compareRatings(own, competitors);

    let textAnalysis: TextAnalysisResult | null;
    try {
      textAnalysis = await this.insightsGenerator.analyzeReviewText(
        { ...own, reviews: ownReviews },
        competitors,
      );
    } catch (err) {
      if (err instanceof TextAnalysisNotImplementedError) {
        textAnalysis = null;
      } else {
        throw err;
      }
    }

    return { cardComparison, ratingComparison, textAnalysis };
  }
}

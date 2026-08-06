import {
  CompetitorProfile,
  OwnCompanyProfile,
  TextAnalysisResult,
} from './types';

// Seam для подключения реального AI-вызова позже (см. Further Notes плана —
// Claude Sonnet 5 + structured outputs + Citations), без изменения остального
// пайплайна. Сейчас единственная реализация — DeterministicInsightsGenerator,
// у которой analyzeReviewText — явная заглушка (см.
// TextAnalysisNotImplementedError).
export interface CompetitorInsightsGenerator {
  analyzeReviewText(
    own: OwnCompanyProfile & { reviews: string[] },
    competitors: CompetitorProfile[],
  ): Promise<TextAnalysisResult>;
}

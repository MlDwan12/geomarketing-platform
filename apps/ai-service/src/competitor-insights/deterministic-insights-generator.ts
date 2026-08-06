import { Injectable } from '@nestjs/common';
import { CompetitorInsightsGenerator } from './competitor-insights-generator';
import {
  CompetitorProfile,
  OwnCompanyProfile,
  TextAnalysisResult,
} from './types';
import { TextAnalysisNotImplementedError } from './text-analysis-not-implemented.error';

@Injectable()
export class DeterministicInsightsGenerator implements CompetitorInsightsGenerator {
  /* eslint-disable @typescript-eslint/no-unused-vars -- заглушка, оба
     параметра нужны только для соответствия интерфейсу */
  analyzeReviewText(
    _own: OwnCompanyProfile & { reviews: string[] },
    _competitors: CompetitorProfile[],
  ): Promise<TextAnalysisResult> {
    /* eslint-enable @typescript-eslint/no-unused-vars */
    // Promise.reject(), а не синхронный throw — иначе прямой вызов без
    // окружающего await (см. deterministic-insights-generator.spec.ts) бросает
    // до того, как появляется Promise, и .rejects/catch не срабатывают.
    return Promise.reject(new TextAnalysisNotImplementedError());
  }
}

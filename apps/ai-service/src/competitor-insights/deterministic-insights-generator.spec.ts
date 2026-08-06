import { DeterministicInsightsGenerator } from './deterministic-insights-generator';
import { TextAnalysisNotImplementedError } from './text-analysis-not-implemented.error';

describe('DeterministicInsightsGenerator.analyzeReviewText', () => {
  it('явно бросает TextAnalysisNotImplementedError — не молчаливо возвращает пустой/фейковый результат', async () => {
    const generator = new DeterministicInsightsGenerator();

    await expect(
      generator.analyzeReviewText({ hasPhone: true, reviews: [] }, []),
    ).rejects.toBeInstanceOf(TextAnalysisNotImplementedError);
  });
});

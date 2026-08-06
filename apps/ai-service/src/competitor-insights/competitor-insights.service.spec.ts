import { CompetitorInsightsService } from './competitor-insights.service';
import { DeterministicInsightsGenerator } from './deterministic-insights-generator';
import { OwnCompanyProfile } from './types';

describe('CompetitorInsightsService.generate', () => {
  const own: OwnCompanyProfile = {
    hasPhone: true,
    rating: 4.5,
    reviewCount: 10,
  };

  it('cardComparison/ratingComparison считаются, textAnalysis — null (заглушка не реализована)', async () => {
    const service = new CompetitorInsightsService(
      new DeterministicInsightsGenerator(),
    );

    const result = await service.generate(own, [], ['Отличное место']);

    expect(result.cardComparison).toEqual({
      own: { hasPhone: true },
      competitors: [],
    });
    expect(result.ratingComparison.own).toEqual({
      rating: 4.5,
      reviewCount: 10,
    });
    expect(result.textAnalysis).toBeNull();
  });

  it('неожиданная ошибка генератора не глушится — пробрасывается дальше', async () => {
    const failingGenerator = {
      analyzeReviewText: () => Promise.reject(new Error('boom')),
    } as unknown as DeterministicInsightsGenerator;
    const service = new CompetitorInsightsService(failingGenerator);

    await expect(service.generate(own, [], [])).rejects.toThrow('boom');
  });
});

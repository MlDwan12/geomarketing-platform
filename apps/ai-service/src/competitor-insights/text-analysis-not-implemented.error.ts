// Явный маркер "не реализовано" для AI-анализа текста отзывов — вместо того,
// чтобы молча возвращать пустой/фейковый результат, который можно принять за
// настоящий анализ (см. Testing Decisions в
// docs/refactor-plans/competitor-analysis-report.md). Вызывающий код
// (CompetitorInsightsService) ловит именно этот тип ошибки и сохраняет
// textAnalysis: null в отчёте — любая другая ошибка продолжает падать дальше.
export class TextAnalysisNotImplementedError extends Error {
  constructor() {
    super(
      'AI-анализ текста отзывов ещё не реализован — реальный вызов Claude ' +
        'API сознательно не подключён (см. Out of Scope плана).',
    );
    this.name = 'TextAnalysisNotImplementedError';
  }
}

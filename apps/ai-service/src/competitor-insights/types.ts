// Контракт AI_COMPETITOR_ANALYSIS_GENERATE (см.
// docs/refactor-plans/competitor-analysis-report.md, коммит 5). Форма
// намеренно узкая — под данные, которые реально доступны из публичного
// поиска (CompetitorListing из integration-service): нет schedule/photos/
// description ни у своей компании в этом контракте, ни у конкурентов —
// только то, что честно сравнимо между обеими сторонами сейчас. Мэппинг
// из реальных Company/CompetitorListing в эту форму — задача оркестрации
// (коммит 6), не этого модуля.

export interface OwnCompanyProfile {
  hasPhone: boolean;
  category?: string;
  rating?: number;
  reviewCount?: number;
}

export interface CompetitorProfile {
  name: string;
  hasPhone: boolean;
  category?: string;
  rating?: number;
  reviewCount?: number;
  // Тексты отзывов — для будущего реального AI-анализа (сейчас заглушка,
  // не читает reviews вообще). Оставлено в контракте, чтобы подключение
  // реального вызова не меняло форму входа.
  reviews: string[];
}

export interface CardComparisonResult {
  own: { hasPhone: boolean };
  competitors: { name: string; hasPhone: boolean }[];
}

export interface RatingComparisonResult {
  own: { rating?: number; reviewCount?: number };
  competitors: { name: string; rating?: number; reviewCount?: number }[];
  // 1 = лучший рейтинг среди своей компании и конкурентов с известным
  // рейтингом. undefined — если у своей компании рейтинг неизвестен.
  ownRank?: number;
  averageCompetitorRating?: number;
}

export interface TextAnalysisResult {
  strengths: string[];
  weaknesses: string[];
}

import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

// Сохраняемый отчёт сравнения Company с CompetitorListing на всех MapProvider
// (см. CONTEXT.md, термины CompetitorListing/CompetitorAnalysisReport). История,
// не перезапись — на одну companyId несколько строк, последняя по createdAt
// считается актуальной. Сырой текст скрапнутых отзывов не хранится — только
// итоговый вывод сравнения (см. docs/refactor-plans/competitor-analysis-report.md,
// Out of Scope).
@Entity('competitor_analysis_reports')
export class CompetitorAnalysisReport {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  companyId!: string;

  // Найденные CompetitorListing (до 5, дедуп между провайдерами) с метаданными:
  // provider(s), внешний id, название, координаты, категория, рейтинг,
  // кол-во отзывов. Форма не фиксируется на уровне entity — определяется в
  // коммите 3 плана (поиск CompetitorListing).
  @Column({ type: 'jsonb' })
  competitors: unknown[] = [];

  @Column({ type: 'jsonb' })
  cardComparison: Record<string, unknown> = {};

  @Column({ type: 'jsonb' })
  ratingComparison: Record<string, unknown> = {};

  // null, пока AI-анализ текста отзывов не реализован (см. Out of Scope плана —
  // CompetitorInsightsGenerator сейчас заглушка).
  @Column({ type: 'jsonb', nullable: true })
  textAnalysis: Record<string, unknown> | null = null;

  @CreateDateColumn()
  createdAt!: Date;
}

import { ApiProperty } from '@nestjs/swagger';

// Форма ответа core-service COMPETITOR_ANALYSIS_SAVE — только идентификаторы
// сохранённой записи. Полное содержимое (competitors/cardComparison/
// ratingComparison/textAnalysis) отдаёт GET .../latest, см.
// CompetitorAnalysisReportDto ниже.
export class SavedCompetitorAnalysisReportDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  companyId!: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}

export class CompetitorAnalysisReportDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  companyId!: string;

  @ApiProperty({
    type: 'array',
    items: { type: 'object' },
    description: 'Найденные конкуренты (до 5), сырые CompetitorListing',
  })
  competitors!: unknown[];

  @ApiProperty({ type: 'object', additionalProperties: true })
  cardComparison!: Record<string, unknown>;

  @ApiProperty({ type: 'object', additionalProperties: true })
  ratingComparison!: Record<string, unknown>;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    nullable: true,
    description: 'Всегда null — реальный AI-анализ текста отзывов не подключён',
  })
  textAnalysis!: Record<string, unknown> | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}

export class BrandGenerationResultDto {
  @ApiProperty({ format: 'uuid' })
  companyId!: string;

  @ApiProperty()
  success!: boolean;

  @ApiProperty({ type: SavedCompetitorAnalysisReportDto, required: false })
  report?: SavedCompetitorAnalysisReportDto;

  @ApiProperty({
    required: false,
    description:
      'Сообщение ошибки, если генерация для этой компании упала (сеть/AI/скрапинг) — остальные компании бренда всё равно обрабатываются',
  })
  error?: string;
}

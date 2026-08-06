import { ApiProperty } from '@nestjs/swagger';

// Форма ответа core-service COMPETITOR_ANALYSIS_SAVE — только идентификаторы
// сохранённой записи. Полное содержимое отчёта (competitors/cardComparison/
// ratingComparison/textAnalysis) отдаётся отдельными эндпоинтами core-service
// (getLatest/listHistory, см. CompetitorAnalysisReportService) — в этом
// api-gateway модуле пока не проброшено наружу HTTP (только генерация).
export class SavedCompetitorAnalysisReportDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  companyId!: string;

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

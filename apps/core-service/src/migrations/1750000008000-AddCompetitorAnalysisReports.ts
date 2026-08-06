import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * competitor_analysis_reports — сохраняемая история отчётов CompetitorAnalysisReport
 * (см. CONTEXT.md, docs/refactor-plans/competitor-analysis-report.md). Коммит 1
 * плана: только хранение, без бизнес-логики поиска конкурентов. Несколько строк
 * на одну companyId (история версий, не перезапись) — отсюда индекс на companyId
 * для выборки последней/всех версий отчёта по компании.
 */
export class AddCompetitorAnalysisReports1750000008000
  implements MigrationInterface
{
  name = 'AddCompetitorAnalysisReports1750000008000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "competitor_analysis_reports" (
        "id"              uuid NOT NULL DEFAULT gen_random_uuid(),
        "companyId"       uuid NOT NULL,
        "competitors"     jsonb NOT NULL DEFAULT '[]',
        "cardComparison"  jsonb NOT NULL DEFAULT '{}',
        "ratingComparison" jsonb NOT NULL DEFAULT '{}',
        "textAnalysis"    jsonb,
        "createdAt"       TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_competitor_analysis_reports" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_competitor_analysis_reports_companyId"
      ON "competitor_analysis_reports" ("companyId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "IDX_competitor_analysis_reports_companyId"`,
    );
    await queryRunner.query(`DROP TABLE "competitor_analysis_reports"`);
  }
}

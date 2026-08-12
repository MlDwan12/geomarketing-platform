import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * tracked_keywords — постоянный список ручных ключевых слов на компанию для
 * чекера позиций (см. docs/refactor-plans/position-checker.md, коммит 1).
 * Только хранение/CRUD ключевых слов, без результатов проверки (та сущность
 * — PositionCheckResult, коммит 2). Индекс на companyId для выборки списка
 * слов одной компании.
 */
export class AddTrackedKeywords1750000012000 implements MigrationInterface {
  name = 'AddTrackedKeywords1750000012000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "tracked_keywords" (
        "id"        uuid NOT NULL DEFAULT gen_random_uuid(),
        "companyId" uuid NOT NULL,
        "keyword"   text NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tracked_keywords" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_tracked_keywords_companyId"
      ON "tracked_keywords" ("companyId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_tracked_keywords_companyId"`);
    await queryRunner.query(`DROP TABLE "tracked_keywords"`);
  }
}

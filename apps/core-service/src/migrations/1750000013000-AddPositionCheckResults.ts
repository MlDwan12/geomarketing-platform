import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * position_check_results — история проверок позиции компании в выдаче
 * 2ГИС/Яндекса по ключевым словам (см. docs/refactor-plans/position-checker.md,
 * коммит 2). Несколько строк на одну companyId+keyword (история/тренд, не
 * перезапись) — отсюда индекс на companyId для выборки всей истории компании.
 */
export class AddPositionCheckResults1750000013000 implements MigrationInterface {
  name = 'AddPositionCheckResults1750000013000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "position_check_results" (
        "id"        uuid NOT NULL DEFAULT gen_random_uuid(),
        "companyId" uuid NOT NULL,
        "keyword"   text NOT NULL,
        "source"    text NOT NULL,
        "provider"  text NOT NULL,
        "position"  int,
        "checkedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_position_check_results" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_position_check_results_companyId"
      ON "position_check_results" ("companyId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "IDX_position_check_results_companyId"`,
    );
    await queryRunner.query(`DROP TABLE "position_check_results"`);
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * DB-001 — индексы под частые выборки. Только CREATE INDEX (аддитивно, данные не трогаются).
 *
 * Не дублирует существующие индексы из PK/UNIQUE:
 *   - company_defaults(companyId)         — PRIMARY KEY
 *   - company_group_members(groupId, ...) — PRIMARY KEY (ведущий столбец groupId)
 *   - company_platforms(companyId, platformKey) — UNIQUE
 *   - user_brands(userId, brandId)        — UNIQUE
 *   - companies(slug), brands(slug)       — UNIQUE
 */
export class AddIndexes1750000006000 implements MigrationInterface {
  name = 'AddIndexes1750000006000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // companies: list/get фильтруют по brandId
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_companies_brandId" ON "companies" ("brandId")`,
    );
    // company_platforms: findByTwoGisOrgId — WHERE platformKey='twogis' AND orgId=$1
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_company_platforms_platformKey_orgId" ON "company_platforms" ("platformKey", "orgId")`,
    );
    // company_defaults: JOIN/выборка по templateId (статистика шаблонов, getTemplate, detach при удалении)
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_company_defaults_templateId" ON "company_defaults" ("templateId")`,
    );
    // company_templates: список/статистика по brandId
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_company_templates_brandId" ON "company_templates" ("brandId")`,
    );
    // company_groups: список/статистика по brandId
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_company_groups_brandId" ON "company_groups" ("brandId")`,
    );
    // company_group_members: выборка/удаление по companyId (groupId уже покрыт PK)
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_company_group_members_companyId" ON "company_group_members" ("companyId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_company_group_members_companyId"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_company_groups_brandId"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_company_templates_brandId"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_company_defaults_templateId"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_company_platforms_platformKey_orgId"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_companies_brandId"`);
  }
}

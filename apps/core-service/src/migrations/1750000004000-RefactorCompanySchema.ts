import { MigrationInterface, QueryRunner } from 'typeorm';

export class RefactorCompanySchema1750000004000 implements MigrationInterface {
  name = 'RefactorCompanySchema1750000004000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. company_templates — brand-level templates with flat field values
    await queryRunner.query(`
      CREATE TABLE "company_templates" (
        "id"        uuid                  NOT NULL DEFAULT gen_random_uuid(),
        "brandId"   uuid                  NOT NULL,
        "name"      character varying(255) NOT NULL,
        "fields"    jsonb                 NOT NULL DEFAULT '{}',
        "createdAt" TIMESTAMP             NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP             NOT NULL DEFAULT now(),
        CONSTRAINT "PK_company_templates" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "company_templates"
        ADD CONSTRAINT "FK_company_templates_brand"
        FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE CASCADE
    `);

    // 2. company_defaults — per-company per-field overrides + template ref
    await queryRunner.query(`
      CREATE TABLE "company_defaults" (
        "companyId"      uuid      NOT NULL,
        "templateId"     uuid,
        "fieldOverrides" jsonb     NOT NULL DEFAULT '{}',
        "updatedAt"      TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_company_defaults" PRIMARY KEY ("companyId")
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "company_defaults"
        ADD CONSTRAINT "FK_company_defaults_company"
        FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "company_defaults"
        ADD CONSTRAINT "FK_company_defaults_template"
        FOREIGN KEY ("templateId") REFERENCES "company_templates"("id") ON DELETE SET NULL
    `);

    // 3. Migrate company_cards → company_defaults
    //    Each non-null field becomes { isException: true, value: <field_value> }
    await queryRunner.query(`
      INSERT INTO "company_defaults" ("companyId", "fieldOverrides")
      SELECT
        "companyId",
        (
          COALESCE(
            CASE WHEN "names"                IS NOT NULL THEN jsonb_build_object('names',                jsonb_build_object('isException', true, 'value', "names"))                ELSE '{}'::jsonb END ||
            CASE WHEN "shortNames"           IS NOT NULL THEN jsonb_build_object('shortNames',           jsonb_build_object('isException', true, 'value', "shortNames"))           ELSE '{}'::jsonb END ||
            CASE WHEN "altNames"             IS NOT NULL THEN jsonb_build_object('altNames',             jsonb_build_object('isException', true, 'value', "altNames"))             ELSE '{}'::jsonb END ||
            CASE WHEN "email"                IS NOT NULL THEN jsonb_build_object('email',                jsonb_build_object('isException', true, 'value', "email"))                ELSE '{}'::jsonb END ||
            CASE WHEN "phones"               IS NOT NULL THEN jsonb_build_object('phones',               jsonb_build_object('isException', true, 'value', "phones"))               ELSE '{}'::jsonb END ||
            CASE WHEN "address"              IS NOT NULL THEN jsonb_build_object('address',              jsonb_build_object('isException', true, 'value', "address"))              ELSE '{}'::jsonb END ||
            CASE WHEN "websites"             IS NOT NULL THEN jsonb_build_object('websites',             jsonb_build_object('isException', true, 'value', "websites"))             ELSE '{}'::jsonb END ||
            CASE WHEN "socials"              IS NOT NULL THEN jsonb_build_object('socials',              jsonb_build_object('isException', true, 'value', "socials"))              ELSE '{}'::jsonb END ||
            CASE WHEN "mainCategory"         IS NOT NULL THEN jsonb_build_object('mainCategory',         jsonb_build_object('isException', true, 'value', "mainCategory"))         ELSE '{}'::jsonb END ||
            CASE WHEN "additionalCategories" IS NOT NULL THEN jsonb_build_object('additionalCategories', jsonb_build_object('isException', true, 'value', "additionalCategories")) ELSE '{}'::jsonb END ||
            CASE WHEN "descriptions"         IS NOT NULL THEN jsonb_build_object('descriptions',         jsonb_build_object('isException', true, 'value', "descriptions"))         ELSE '{}'::jsonb END ||
            CASE WHEN "shortDescriptions"    IS NOT NULL THEN jsonb_build_object('shortDescriptions',    jsonb_build_object('isException', true, 'value', "shortDescriptions"))    ELSE '{}'::jsonb END ||
            CASE WHEN "schedule"             IS NOT NULL THEN jsonb_build_object('schedule',             jsonb_build_object('isException', true, 'value', "schedule"))             ELSE '{}'::jsonb END ||
            CASE WHEN "specialDays"          IS NOT NULL THEN jsonb_build_object('specialDays',          jsonb_build_object('isException', true, 'value', "specialDays"))          ELSE '{}'::jsonb END,
            '{}'::jsonb
          )
        ) AS "fieldOverrides"
      FROM "company_cards"
    `);

    // 4. Drop company_cards
    await queryRunner.query(`ALTER TABLE "company_cards" DROP CONSTRAINT "FK_company_cards_company"`);
    await queryRunner.query(`DROP TABLE "company_cards"`);

    // 5. Migrate company_platforms: enum → VARCHAR platformKey
    await queryRunner.query(`ALTER TABLE "company_platforms" ADD COLUMN "platformKey" character varying(64)`);
    await queryRunner.query(`UPDATE "company_platforms" SET "platformKey" = "platform"::text`);
    await queryRunner.query(`ALTER TABLE "company_platforms" ALTER COLUMN "platformKey" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "company_platforms" DROP CONSTRAINT "UQ_company_platforms_company_platform"`);
    await queryRunner.query(`ALTER TABLE "company_platforms" DROP COLUMN "platform"`);
    await queryRunner.query(`DROP TYPE "public"."company_platforms_platform_enum"`);
    await queryRunner.query(`
      ALTER TABLE "company_platforms"
        ADD CONSTRAINT "UQ_company_platforms_company_platformKey" UNIQUE ("companyId", "platformKey")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Restore company_platforms enum
    await queryRunner.query(`ALTER TABLE "company_platforms" DROP CONSTRAINT "UQ_company_platforms_company_platformKey"`);
    await queryRunner.query(`CREATE TYPE "public"."company_platforms_platform_enum" AS ENUM('yandex', 'twogis')`);
    await queryRunner.query(`ALTER TABLE "company_platforms" ADD COLUMN "platform" "public"."company_platforms_platform_enum"`);
    await queryRunner.query(`UPDATE "company_platforms" SET "platform" = "platformKey"::"public"."company_platforms_platform_enum" WHERE "platformKey" IN ('yandex', 'twogis')`);
    await queryRunner.query(`DELETE FROM "company_platforms" WHERE "platform" IS NULL`);
    await queryRunner.query(`ALTER TABLE "company_platforms" ALTER COLUMN "platform" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "company_platforms" DROP COLUMN "platformKey"`);
    await queryRunner.query(`ALTER TABLE "company_platforms" ADD CONSTRAINT "UQ_company_platforms_company_platform" UNIQUE ("companyId", "platform")`);

    // Restore company_cards
    await queryRunner.query(`
      CREATE TABLE "company_cards" (
        "companyId"            uuid      NOT NULL,
        "names"                jsonb,
        "shortNames"           jsonb,
        "altNames"             jsonb,
        "email"                jsonb,
        "phones"               jsonb,
        "address"              jsonb,
        "websites"             jsonb,
        "socials"              jsonb,
        "mainCategory"         jsonb,
        "additionalCategories" jsonb,
        "descriptions"         jsonb,
        "shortDescriptions"    jsonb,
        "schedule"             jsonb,
        "specialDays"          jsonb,
        "updatedAt"            TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_company_cards" PRIMARY KEY ("companyId")
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "company_cards"
        ADD CONSTRAINT "FK_company_cards_company"
        FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE
    `);

    // Drop new tables
    await queryRunner.query(`ALTER TABLE "company_defaults" DROP CONSTRAINT "FK_company_defaults_template"`);
    await queryRunner.query(`ALTER TABLE "company_defaults" DROP CONSTRAINT "FK_company_defaults_company"`);
    await queryRunner.query(`DROP TABLE "company_defaults"`);
    await queryRunner.query(`ALTER TABLE "company_templates" DROP CONSTRAINT "FK_company_templates_brand"`);
    await queryRunner.query(`DROP TABLE "company_templates"`);
  }
}

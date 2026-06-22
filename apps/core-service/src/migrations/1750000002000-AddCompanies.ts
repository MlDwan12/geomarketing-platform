import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCompanies1750000002000 implements MigrationInterface {
  name = 'AddCompanies1750000002000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."companies_status_enum" AS ENUM('draft', 'active', 'temporarily_closed', 'suspended', 'deleted')`,
    );
    await queryRunner.query(`
      CREATE TABLE "companies" (
        "id"             uuid                                NOT NULL DEFAULT gen_random_uuid(),
        "brandId"        uuid                                NOT NULL,
        "name"           character varying(255)              NOT NULL,
        "slug"           character varying(300)              NOT NULL,
        "status"         "public"."companies_status_enum"    NOT NULL DEFAULT 'draft',
        "code"           character varying(50),
        "addressDisplay" text,
        "rating"         numeric(3,1),
        "reviewCount"    integer                             NOT NULL DEFAULT 0,
        "createdAt"      TIMESTAMP                           NOT NULL DEFAULT now(),
        "updatedAt"      TIMESTAMP                           NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_companies_slug" UNIQUE ("slug"),
        CONSTRAINT "PK_companies"     PRIMARY KEY ("id")
      )
    `);

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

    await queryRunner.query(
      `CREATE TYPE "public"."company_platforms_platform_enum" AS ENUM('yandex', 'twogis')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."company_platforms_status_enum" AS ENUM('not_connected', 'connected', 'pending', 'action_required', 'disconnected', 'error')`,
    );
    await queryRunner.query(`
      CREATE TABLE "company_platforms" (
        "id"          uuid                                        NOT NULL DEFAULT gen_random_uuid(),
        "companyId"   uuid                                        NOT NULL,
        "platform"    "public"."company_platforms_platform_enum"  NOT NULL,
        "status"      "public"."company_platforms_status_enum"    NOT NULL DEFAULT 'not_connected',
        "isEnabled"   boolean                                     NOT NULL DEFAULT false,
        "orgId"       character varying(100),
        "orgName"     character varying(255),
        "connectedAt" TIMESTAMP,
        "lastSyncAt"  TIMESTAMP,
        "syncError"   text,
        CONSTRAINT "UQ_company_platforms_company_platform" UNIQUE ("companyId", "platform"),
        CONSTRAINT "PK_company_platforms"                  PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `ALTER TABLE "company_cards" ADD CONSTRAINT "FK_company_cards_company" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "company_platforms" ADD CONSTRAINT "FK_company_platforms_company" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "company_platforms" DROP CONSTRAINT "FK_company_platforms_company"`);
    await queryRunner.query(`ALTER TABLE "company_cards" DROP CONSTRAINT "FK_company_cards_company"`);
    await queryRunner.query(`DROP TABLE "company_platforms"`);
    await queryRunner.query(`DROP TYPE "public"."company_platforms_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."company_platforms_platform_enum"`);
    await queryRunner.query(`DROP TABLE "company_cards"`);
    await queryRunner.query(`DROP TABLE "companies"`);
    await queryRunner.query(`DROP TYPE "public"."companies_status_enum"`);
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCompanyGroups1750000005000 implements MigrationInterface {
  name = 'AddCompanyGroups1750000005000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TYPE "public"."companies_status_enum" ADD VALUE 'closed' AFTER 'temporarily_closed'`);

    await queryRunner.query(`
      CREATE TABLE "company_groups" (
        "id"        uuid                   NOT NULL DEFAULT gen_random_uuid(),
        "brandId"   uuid                   NOT NULL,
        "name"      character varying(255) NOT NULL,
        "createdAt" TIMESTAMP              NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP              NOT NULL DEFAULT now(),
        CONSTRAINT "PK_company_groups" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "company_groups"
        ADD CONSTRAINT "FK_company_groups_brand"
        FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      CREATE TABLE "company_group_members" (
        "groupId"   uuid NOT NULL,
        "companyId" uuid NOT NULL,
        CONSTRAINT "PK_company_group_members" PRIMARY KEY ("groupId", "companyId")
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "company_group_members"
        ADD CONSTRAINT "FK_cgm_group"
        FOREIGN KEY ("groupId") REFERENCES "company_groups"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "company_group_members"
        ADD CONSTRAINT "FK_cgm_company"
        FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "company_group_members" DROP CONSTRAINT "FK_cgm_company"`);
    await queryRunner.query(`ALTER TABLE "company_group_members" DROP CONSTRAINT "FK_cgm_group"`);
    await queryRunner.query(`DROP TABLE "company_group_members"`);
    await queryRunner.query(`ALTER TABLE "company_groups" DROP CONSTRAINT "FK_company_groups_brand"`);
    await queryRunner.query(`DROP TABLE "company_groups"`);
    // Note: PostgreSQL does not support removing enum values — 'closed' stays in the type
  }
}

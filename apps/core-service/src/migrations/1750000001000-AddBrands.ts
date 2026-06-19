import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBrands1750000001000 implements MigrationInterface {
  name = 'AddBrands1750000001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."brands_status_enum" AS ENUM('active', 'suspended', 'deleted')`,
    );
    await queryRunner.query(`
      CREATE TABLE "brands" (
        "id"          uuid                           NOT NULL DEFAULT gen_random_uuid(),
        "name"        character varying(100)         NOT NULL,
        "slug"        character varying(120)         NOT NULL,
        "ownerId"     uuid                           NOT NULL,
        "status"      "public"."brands_status_enum"  NOT NULL DEFAULT 'active',
        "timezone"    character varying(64)          NOT NULL,
        "description" text,
        "logoUrl"     character varying(500),
        "createdAt"   TIMESTAMP                      NOT NULL DEFAULT now(),
        "updatedAt"   TIMESTAMP                      NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_brands_slug" UNIQUE ("slug"),
        CONSTRAINT "PK_brands"     PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE TYPE "public"."user_brands_role_enum"   AS ENUM('owner', 'admin', 'manager', 'viewer')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."user_brands_status_enum" AS ENUM('active', 'suspended', 'left', 'pending')`,
    );
    await queryRunner.query(`
      CREATE TABLE "user_brands" (
        "id"          uuid                                NOT NULL DEFAULT gen_random_uuid(),
        "userId"      uuid                                NOT NULL,
        "brandId"     uuid                                NOT NULL,
        "role"        "public"."user_brands_role_enum"    NOT NULL,
        "status"      "public"."user_brands_status_enum"  NOT NULL DEFAULT 'active',
        "joinedAt"    TIMESTAMP                           NOT NULL DEFAULT now(),
        "lastLoginAt" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "UQ_user_brands_user_brand" UNIQUE ("userId", "brandId"),
        CONSTRAINT "PK_user_brands"            PRIMARY KEY ("id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "user_brands"`);
    await queryRunner.query(`DROP TYPE "public"."user_brands_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."user_brands_role_enum"`);
    await queryRunner.query(`DROP TABLE "brands"`);
    await queryRunner.query(`DROP TYPE "public"."brands_status_enum"`);
  }
}

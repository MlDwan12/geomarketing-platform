import { MigrationInterface, QueryRunner } from 'typeorm';

export class Init1750000000000 implements MigrationInterface {
  name = 'Init1750000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."users_role_enum" AS ENUM('owner', 'admin', 'manager', 'viewer')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."users_status_enum" AS ENUM('active', 'suspended', 'left', 'pending')`,
    );
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id"             uuid                          NOT NULL DEFAULT gen_random_uuid(),
        "name"           character varying(100)        NOT NULL,
        "fullName"       character varying(200),
        "email"          character varying(254)        NOT NULL,
        "passwordHash"   character varying             NOT NULL,
        "role"           "public"."users_role_enum"    NOT NULL DEFAULT 'owner',
        "status"         "public"."users_status_enum"  NOT NULL DEFAULT 'active',
        "phone"          character varying(30),
        "telegram"       character varying(64),
        "twoFaEnabled"   boolean                       NOT NULL DEFAULT false,
        "avatarUrl"      character varying(500),
        "timezone"       character varying(64),
        "locale"         character varying(10),
        "refCode"        character varying(32),
        "referredById"   character varying,
        "createdAt"      TIMESTAMP                     NOT NULL DEFAULT now(),
        "updatedAt"      TIMESTAMP                     NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_users_email"   UNIQUE ("email"),
        CONSTRAINT "UQ_users_refCode" UNIQUE ("refCode"),
        CONSTRAINT "PK_users"         PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "password_reset_tokens" (
        "id"          uuid              NOT NULL DEFAULT gen_random_uuid(),
        "userId"      character varying NOT NULL,
        "tokenHash"   character varying NOT NULL,
        "expiresAt"   TIMESTAMP         NOT NULL,
        "usedAt"      TIMESTAMP WITH TIME ZONE,
        "createdAt"   TIMESTAMP         NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_prt_tokenHash"        UNIQUE ("tokenHash"),
        CONSTRAINT "PK_password_reset_tokens" PRIMARY KEY ("id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "password_reset_tokens"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "public"."users_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
  }
}

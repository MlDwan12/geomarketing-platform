import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * team_invitations — приглашение в команду Brand (см. CONTEXT.md,
 * docs/refactor-plans/team-brand-roles.md, коммит 10 плана). Только хранение,
 * без бизнес-логики (invite/accept/revoke) — она в следующих коммитах плана.
 * Индекс на (brandId, email) — не уникальный: старые revoked/expired/accepted
 * записи должны сохраняться как история, "нет активного pending-дубля"
 * проверяется на уровне приложения (TeamService), не констрейнтом БД.
 */
export class AddTeamInvitations1750000011000 implements MigrationInterface {
  name = 'AddTeamInvitations1750000011000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."team_invitations_role_enum" AS ENUM('owner', 'manager', 'viewer')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."team_invitations_status_enum" AS ENUM('pending', 'accepted', 'revoked', 'expired')`,
    );

    await queryRunner.query(`
      CREATE TABLE "team_invitations" (
        "id"              uuid NOT NULL DEFAULT gen_random_uuid(),
        "brandId"         uuid NOT NULL,
        "email"           varchar(254) NOT NULL,
        "role"            "public"."team_invitations_role_enum" NOT NULL,
        "invitedByUserId" uuid NOT NULL,
        "tokenHash"       varchar NOT NULL,
        "expiresAt"       TIMESTAMP NOT NULL,
        "status"          "public"."team_invitations_status_enum" NOT NULL DEFAULT 'pending',
        "createdAt"       TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_team_invitations" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_team_invitations_tokenHash" UNIQUE ("tokenHash")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_team_invitations_brandId_email"
      ON "team_invitations" ("brandId", "email")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_team_invitations_brandId_email"`);
    await queryRunner.query(`DROP TABLE "team_invitations"`);
    await queryRunner.query(
      `DROP TYPE "public"."team_invitations_status_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."team_invitations_role_enum"`);
  }
}

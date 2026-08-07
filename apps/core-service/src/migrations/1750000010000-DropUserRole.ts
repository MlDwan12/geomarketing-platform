import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * User.role — мёртвое поле (см. CONTEXT.md, docs/refactor-plans/team-brand-roles.md):
 * глобальная роль по умолчанию 'owner' у каждого нового пользователя, нигде не
 * читалась для авторизации, только отображалась в сессии/`/me`. Реальный контроль
 * доступа — BrandRole (per-brand, см. миграцию 1750000009000).
 */
export class DropUserRole1750000010000 implements MigrationInterface {
  name = 'DropUserRole1750000010000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "role"`);
    await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."users_role_enum" AS ENUM('owner', 'admin', 'manager', 'viewer')`,
    );
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN "role" "public"."users_role_enum" NOT NULL DEFAULT 'owner'
    `);
  }
}

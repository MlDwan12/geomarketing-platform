import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * BrandRole (см. CONTEXT.md, docs/refactor-plans/team-brand-roles.md) — сужаем
 * user_brands_role_enum с 4 значений (owner/admin/manager/viewer) до 3
 * (owner/manager/viewer). Postgres не поддерживает DROP VALUE у enum — тип
 * пересоздаётся, колонка переносится через USING. 'admin' маппится в 'manager'
 * (на случай, если такая строка когда-либо была создана вручную — по факту
 * в коде это значение никогда не присваивалось).
 */
export class NarrowUserBrandsRole1750000009000 implements MigrationInterface {
  name = 'NarrowUserBrandsRole1750000009000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."user_brands_role_enum_new" AS ENUM('owner', 'manager', 'viewer')`,
    );

    // Некоторые окружения унаследовали DEFAULT на "role" от раннего
    // synchronize:true (ни сущность, ни AddBrands-миграция дефолт не
    // объявляют) — Postgres не может автоматически привести такой DEFAULT
    // к новому типу enum при ALTER COLUMN TYPE. Снимаем его перед сменой
    // типа; если дефолта нет — команда безопасно ничего не делает.
    await queryRunner.query(
      `ALTER TABLE "user_brands" ALTER COLUMN "role" DROP DEFAULT`,
    );

    await queryRunner.query(`
      ALTER TABLE "user_brands"
      ALTER COLUMN "role" TYPE "public"."user_brands_role_enum_new"
      USING (
        CASE "role"::text
          WHEN 'admin' THEN 'manager'
          ELSE "role"::text
        END
      )::"public"."user_brands_role_enum_new"
    `);

    await queryRunner.query(`DROP TYPE "public"."user_brands_role_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."user_brands_role_enum_new" RENAME TO "user_brands_role_enum"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."user_brands_role_enum_old" AS ENUM('owner', 'admin', 'manager', 'viewer')`,
    );

    await queryRunner.query(`
      ALTER TABLE "user_brands"
      ALTER COLUMN "role" TYPE "public"."user_brands_role_enum_old"
      USING "role"::text::"public"."user_brands_role_enum_old"
    `);

    await queryRunner.query(`DROP TYPE "public"."user_brands_role_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."user_brands_role_enum_old" RENAME TO "user_brands_role_enum"`,
    );
  }
}

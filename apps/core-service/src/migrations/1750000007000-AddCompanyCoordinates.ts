import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * coordinates на Company — [lon, lat], nullable. Нужны для MapVisibility-проверки
 * (сопоставление Company с результатами публичного поиска 2ГИС/Яндекс по координатам +
 * названию, см. CONTEXT.md). Данные уже приходят при 2ГИС-импорте (catalog.point), просто
 * раньше не сохранялись — с этой миграции сохраняются для новых импортов; старые Company
 * останутся с coordinates = null (сопоставление для них — только по тексту, ниже точность).
 */
export class AddCompanyCoordinates1750000007000 implements MigrationInterface {
  name = 'AddCompanyCoordinates1750000007000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "companies" ADD COLUMN "coordinates" jsonb`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "companies" DROP COLUMN "coordinates"`,
    );
  }
}

import 'reflect-metadata';
import { join } from 'path';
import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { User } from './src/user/user.entity';
import { PasswordResetToken } from './src/password-reset/password-reset-token.entity';
import { Brand } from './src/brand/brand.entity';
import { UserBrand } from './src/brand/user-brand.entity';
import { CompetitorAnalysisReport } from './src/competitor-analysis/entities/competitor-analysis-report.entity';
import { TeamInvitation } from './src/team/team-invitation.entity';

// Путь резолвится от каталога файла (apps/core-service), а не от CWD:
// dotenv по умолчанию читает от process.cwd(), из-за чего CLI-миграции не грузили .env.
config({ path: join(__dirname, '../../.env') });

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [
    User,
    PasswordResetToken,
    Brand,
    UserBrand,
    CompetitorAnalysisReport,
    TeamInvitation,
  ],
  migrations: [join(__dirname, 'src/migrations/*.ts')],
  synchronize: false,
});

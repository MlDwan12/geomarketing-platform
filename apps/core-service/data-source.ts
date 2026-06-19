import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { User } from './src/user/user.entity';
import { PasswordResetToken } from './src/password-reset/password-reset-token.entity';
import { Brand } from './src/brand/brand.entity';
import { UserBrand } from './src/brand/user-brand.entity';

config({ path: '../../.env' });

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [User, PasswordResetToken, Brand, UserBrand],
  migrations: ['./src/migrations/*.ts'],
  synchronize: false,
});

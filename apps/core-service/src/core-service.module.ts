import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppConfigModule } from '@geo/config';
import { CoreServiceController } from './core-service.controller';
import { CoreServiceService } from './core-service.service';
import { UserModule } from './user/user.module';
import { PasswordResetModule } from './password-reset/password-reset.module';
import { BrandModule } from './brand/brand.module';
import { CompanyModule } from './company/company.module';
import { Init1750000000000 } from './migrations/1750000000000-Init';
import { AddBrands1750000001000 } from './migrations/1750000001000-AddBrands';
import { AddCompanies1750000002000 } from './migrations/1750000002000-AddCompanies';
import { AddLastLoginAt1750000003000 } from './migrations/1750000003000-AddLastLoginAt';

@Module({
  imports: [
    AppConfigModule,
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('DATABASE_URL'),
        autoLoadEntities: true,
        synchronize: false,
        migrationsRun: true,
        extra: { options: '-c timezone=Europe/Moscow' },
        migrations: [Init1750000000000, AddBrands1750000001000, AddCompanies1750000002000, AddLastLoginAt1750000003000],
        logging: config.get('NODE_ENV') === 'development',
      }),
    }),
    UserModule,
    PasswordResetModule,
    BrandModule,
    CompanyModule,
  ],
  controllers: [CoreServiceController],
  providers: [CoreServiceService],
})
export class CoreServiceModule {}

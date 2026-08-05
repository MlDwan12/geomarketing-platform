import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppConfigModule } from '@geo/config';
import { CoreServiceController } from './core-service.controller';
import { CoreServiceService } from './core-service.service';
import { UserModule } from './user/user.module';
import { PasswordResetModule } from './password-reset/password-reset.module';
import { BrandModule } from './brand/brand.module';
import { CompanyModule } from './company/company.module';
import { RpcExceptionFilter } from './rpc-exception.filter';
import { CorrelationIdInterceptor } from './correlation-id.interceptor';
import { Init1750000000000 } from './migrations/1750000000000-Init';
import { AddBrands1750000001000 } from './migrations/1750000001000-AddBrands';
import { AddCompanies1750000002000 } from './migrations/1750000002000-AddCompanies';
import { AddLastLoginAt1750000003000 } from './migrations/1750000003000-AddLastLoginAt';
import { RefactorCompanySchema1750000004000 } from './migrations/1750000004000-RefactorCompanySchema';
import { AddCompanyGroups1750000005000 } from './migrations/1750000005000-AddCompanyGroups';
import { AddIndexes1750000006000 } from './migrations/1750000006000-AddIndexes';
import { AddCompanyCoordinates1750000007000 } from './migrations/1750000007000-AddCompanyCoordinates';

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
        migrations: [
          Init1750000000000,
          AddBrands1750000001000,
          AddCompanies1750000002000,
          AddLastLoginAt1750000003000,
          RefactorCompanySchema1750000004000,
          AddCompanyGroups1750000005000,
          AddIndexes1750000006000,
          AddCompanyCoordinates1750000007000,
        ],
        logging: config.get('NODE_ENV') === 'development',
      }),
    }),
    UserModule,
    PasswordResetModule,
    BrandModule,
    CompanyModule,
  ],
  controllers: [CoreServiceController],
  providers: [
    CoreServiceService,
    // app.useGlobalFilters()/useGlobalInterceptors() в main.ts НЕ покрывают
    // микросервисный контекст гибридного приложения (NestFactory.create() +
    // connectMicroservice()) — применяются только к HTTP-части, которой у
    // core-service нет. Единственный способ, реально работающий для RMQ —
    // регистрация через DI-токены APP_FILTER/APP_INTERCEPTOR.
    { provide: APP_FILTER, useClass: RpcExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: CorrelationIdInterceptor },
  ],
})
export class CoreServiceModule {}

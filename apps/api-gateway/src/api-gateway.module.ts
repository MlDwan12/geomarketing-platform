import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { AppConfigModule } from '@geo/config';
import { Queues } from '@geo/contracts';
import { ApiGatewayController } from './api-gateway.controller';
import { ApiGatewayService } from './api-gateway.service';
import { AuthModule } from './auth/auth.module';
import { BrandsModule } from './brands/brands.module';
import { CompaniesModule } from './companies/companies.module';
import { TemplatesModule } from './templates/templates.module';
import { GroupsModule } from './groups/groups.module';
import { TwoGisImportModule } from './import/two-gis-import.module';
import { TwoGisPlacesModule } from './integrations/two-gis-places.module';
import { YandexPlacesModule } from './integrations/yandex-places.module';
import { UploadModule } from './upload/upload.module';

@Module({
  imports: [
    AppConfigModule,
    ClientsModule.registerAsync([
      {
        name: 'CORE_SERVICE',
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (configService: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [configService.get<string>('RABBITMQ_URL')!],
            queue: Queues.CORE,
            queueOptions: { durable: true },
          },
        }),
      },
    ]),
    AuthModule,
    BrandsModule,
    CompaniesModule,
    GroupsModule,
    TemplatesModule,
    TwoGisImportModule,
    TwoGisPlacesModule,
    YandexPlacesModule,
    UploadModule,
  ],
  controllers: [ApiGatewayController],
  providers: [ApiGatewayService],
})
export class ApiGatewayModule {}

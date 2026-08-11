import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { AppConfigModule } from '@geo/config';
import { Queues } from '@geo/contracts';
import { ApiGatewayController } from './api-gateway.controller';
import { ApiGatewayService } from './api-gateway.service';
import { HealthService } from './health/health.service';
import { AuthModule } from './auth/auth.module';
import { BrandsModule } from './brands/brands.module';
import { CompaniesModule } from './companies/companies.module';
import { TemplatesModule } from './templates/templates.module';
import { GroupsModule } from './groups/groups.module';
import { TwoGisImportModule } from './import/two-gis-import.module';
import { TwoGisPlacesModule } from './integrations/two-gis/two-gis-places.module';
import { YandexPlacesModule } from './integrations/yandex/yandex-places.module';
import { PlacesSearchModule } from './integrations/places-search/places-search.module';
import { CompanyVisibilityModule } from './company-visibility/company-visibility.module';
import { CompetitorAnalysisModule } from './competitor-analysis/competitor-analysis.module';
import { UploadModule } from './upload/upload.module';
import { TeamModule } from './team/team.module';
import { ReviewsModule } from './reviews/reviews.module';

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
      // Только для агрегированного GET /health (см. ApiGatewayController) —
      // остальные HTTP-эндпоинты, которым эти сервисы нужны по делу,
      // регистрируют свои собственные клиенты в своих модулях
      // (CompetitorAnalysisModule, ReviewsModule и т.д.), это отдельные
      // соединения.
      {
        name: 'INTEGRATION_SERVICE',
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (configService: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [configService.get<string>('RABBITMQ_URL')!],
            queue: Queues.INTEGRATION,
            queueOptions: { durable: true },
          },
        }),
      },
      {
        name: 'AI_SERVICE',
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (configService: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [configService.get<string>('RABBITMQ_URL')!],
            queue: Queues.AI,
            queueOptions: { durable: true },
          },
        }),
      },
      {
        name: 'REVIEW_SERVICE',
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (configService: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [configService.get<string>('RABBITMQ_URL')!],
            queue: Queues.REVIEW,
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
    PlacesSearchModule,
    CompanyVisibilityModule,
    CompetitorAnalysisModule,
    UploadModule,
    TeamModule,
    ReviewsModule,
  ],
  controllers: [ApiGatewayController],
  providers: [ApiGatewayService, HealthService],
})
export class ApiGatewayModule {}

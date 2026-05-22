import { Module } from '@nestjs/common';
import { MapParserService } from './map-parser.service';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppConfigModule } from '@geo/config';
import { ReviewEntity } from './entity/yandex-review.entity';
import { YandexParserService } from './yandex-parser/yandex-parser.service';
import { MapParserController } from './map-parser.controller';
import { TwoGisParserService } from './two-gis-parser/two-gis-parser.service';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('DB_HOST'),
        port: +config.get('DB_PORT'),
        username: config.get('DB_USER'),
        password: config.get('DB_PASS'),
        database: config.get('DB_NAME'),

        autoLoadEntities: true,
        synchronize: config.get('NODE_ENV') === 'development',
      }),
    }),
    TypeOrmModule.forFeature([ReviewEntity]),
    AppConfigModule,
  ],
  controllers: [MapParserController],
  providers: [MapParserService, YandexParserService, TwoGisParserService],
})
export class MapParserModule {}

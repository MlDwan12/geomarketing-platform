import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { Queues } from '@geo/contracts';
import { YandexPlacesController } from './yandex-places.controller';

@Module({
  imports: [
    ClientsModule.registerAsync([
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
    ]),
  ],
  controllers: [YandexPlacesController],
})
export class YandexPlacesModule {}

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ThrottlerModule } from '@nestjs/throttler';
import { Queues } from '@geo/contracts';
import { LoggerModule } from '@geo/logger';
import { AuthController } from './auth.controller';

@Module({
  imports: [
    LoggerModule,
    // Rate-limit публичных auth-роутов: 10 запросов / минуту на IP (защита от brute-force).
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 10 }]),
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
  ],
  controllers: [AuthController],
})
export class AuthModule {}

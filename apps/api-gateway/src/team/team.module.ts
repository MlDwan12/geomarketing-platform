import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { Queues } from '@geo/contracts';
import { LoggerModule } from '@geo/logger';
import { MailerModule } from '@geo/mailer';
import { TeamController } from './team.controller';

@Module({
  imports: [
    LoggerModule,
    MailerModule,
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
  controllers: [TeamController],
})
export class TeamModule {}

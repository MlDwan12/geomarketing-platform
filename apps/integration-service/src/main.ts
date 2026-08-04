import { NestFactory } from '@nestjs/core';
import { IntegrationServiceModule } from './integration-service.module';
import { ConfigService } from '@nestjs/config';
import { Queues } from '@geo/contracts';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

async function bootstrap() {
  const app = await NestFactory.create(IntegrationServiceModule);
  const configService = app.get(ConfigService);
  const port = Number(configService.get('INTEGRATION_SERVICE_PORT')) || 3004;
  const rabbitmqUrl = configService.get<string>('RABBITMQ_URL');

  app.connectMicroservice<MicroserviceOptions>(
    {
      transport: Transport.RMQ,
      options: {
        urls: [rabbitmqUrl!],
        queue: Queues.INTEGRATION,
        queueOptions: {
          durable: true,
        },
      },
    },
    // Без inheritAppConfig:true микросервис не видит глобальные enhancer'ы
    // главного приложения (см. фикс в core-service/src/main.ts — было
    // найдено живым smoke-тестом, что connectMicroservice() без этого флага
    // создаёт отдельный ApplicationConfig).
    { inheritAppConfig: true },
  );

  await app.startAllMicroservices();

  await app.listen(port ?? 3000);
}
bootstrap();

import { NestFactory } from '@nestjs/core';
import { ReviewServiceModule } from './review-service.module';
import { ConfigService } from '@nestjs/config';
import { Queues } from '@geo/contracts';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

async function bootstrap() {
  const app = await NestFactory.create(ReviewServiceModule);

  const configService = app.get(ConfigService);
  const port = Number(configService.get('REVIEW_SERVICE_PORT')) || 3002;
  const rabbitmqUrl = configService.get<string>('RABBITMQ_URL');

  app.connectMicroservice<MicroserviceOptions>(
    {
      transport: Transport.RMQ,
      options: {
        urls: [rabbitmqUrl!],
        queue: Queues.REVIEW,
        queueOptions: {
          durable: true,
        },
      },
    },
    // Без inheritAppConfig:true микросервис не видит глобальные enhancer'ы
    // главного приложения (см. фикс в core-service/src/main.ts — найдено
    // живым smoke-тестом, что connectMicroservice() без этого флага создаёт
    // отдельный ApplicationConfig; тот же паттерн уже применён в
    // ai-service/integration-service).
    { inheritAppConfig: true },
  );

  await app.startAllMicroservices();

  await app.listen(port);
}
bootstrap();

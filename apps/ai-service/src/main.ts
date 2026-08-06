import { NestFactory } from '@nestjs/core';
import { AiServiceModule } from './ai-service.module';
import { ConfigService } from '@nestjs/config';
import { Queues } from '@geo/contracts';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

async function bootstrap() {
  const app = await NestFactory.create(AiServiceModule);

  const configService = app.get(ConfigService);
  const port = Number(configService.get('AI_SERVICE_PORT')) || 3003;
  const rabbitmqUrl = configService.get<string>('RABBITMQ_URL');

  app.connectMicroservice<MicroserviceOptions>(
    {
      transport: Transport.RMQ,
      options: {
        urls: [rabbitmqUrl!],
        queue: Queues.AI,
        queueOptions: {
          durable: true,
        },
      },
    },
    // Без inheritAppConfig:true микросервис не видит глобальные enhancer'ы
    // главного приложения (см. фикс в core-service/src/main.ts — найдено
    // живым smoke-тестом, что connectMicroservice() без этого флага создаёт
    // отдельный ApplicationConfig; тот же паттерн уже применён в
    // integration-service/src/main.ts).
    { inheritAppConfig: true },
  );

  await app.startAllMicroservices();

  await app.listen(port);
}
bootstrap();

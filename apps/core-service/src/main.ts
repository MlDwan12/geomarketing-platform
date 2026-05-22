import { NestFactory } from '@nestjs/core';
import { CoreServiceModule } from './core-service.module';
import { ConfigService } from '@nestjs/config';
import { Queues } from '@geo/contracts';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

async function bootstrap() {
  const app = await NestFactory.create(CoreServiceModule);
  const configService = app.get(ConfigService);
  const port = Number(configService.get('CORE_SERVICE_PORT')) || 3001;
  const rabbitmqUrl = configService.get<string>('RABBITMQ_URL');

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [rabbitmqUrl!],
      queue: Queues.CORE,
      queueOptions: {
        durable: true,
      },
    },
  });

  await app.startAllMicroservices();

  await app.listen(port ?? 3000);
}
bootstrap();

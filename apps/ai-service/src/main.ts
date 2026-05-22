import { NestFactory } from '@nestjs/core';
import { AiServiceModule } from './ai-service.module';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AiServiceModule);

  const configService = app.get(ConfigService);
  const port = Number(configService.get('AI_SERVICE_PORT')) || 3003;

  await app.listen(port);
}
bootstrap();

import { NestFactory } from '@nestjs/core';
import { ReviewServiceModule } from './review-service.module';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(ReviewServiceModule);
  const configService = app.get(ConfigService);
  const port = Number(configService.get('REVIEW_SERVICE_PORT')) || 3002;

  await app.listen(port ?? 3000);
}
bootstrap();

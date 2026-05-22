import { NestFactory } from '@nestjs/core';
import { IntegrationServiceModule } from './integration-service.module';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(IntegrationServiceModule);
  const configService = app.get(ConfigService);
  const port = Number(configService.get('PARSER_SERVICE_PORT')) || 3004;

  await app.listen(port ?? 3000);
}
bootstrap();

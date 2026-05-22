import { NestFactory } from '@nestjs/core';
import { MapParserModule } from './map-parser.module';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(MapParserModule);
  const configService = app.get(ConfigService);
  const port = Number(configService.get('INTEGRATION_SERVICE_PORT')) || 3004;
  const server = app.getHttpServer();

  server.keepAliveTimeout = 120_000;
  server.headersTimeout = 121_000;
  server.requestTimeout = 120_000;
  await app.listen(port ?? 3000);
}
bootstrap();

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from 'redis';
import { RedisStore } from 'connect-redis';
import { ApiGatewayModule } from './api-gateway.module';
import { RpcExceptionFilter } from './filters/rpc-exception.filter';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const session = require('express-session');

async function bootstrap() {
  const app = await NestFactory.create(ApiGatewayModule);
  const configService = app.get(ConfigService);

  // ── Redis session store ──────────────────────────────────────────────────
  const redisClient = createClient({
    socket: {
      host: configService.get<string>('REDIS_HOST') ?? 'localhost',
      port: Number(configService.get('REDIS_PORT') ?? 6379),
    },
  });
  redisClient.on('error', (err) => console.error('Redis session error:', err));
  await redisClient.connect();

  app.use(
    session({
      store: new RedisStore({ client: redisClient as any }),
      secret: configService.get<string>('SESSION_SECRET') ?? 'dev-secret-change-in-prod',
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: configService.get('NODE_ENV') === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      },
    }),
  );

  // ── Global pipes & filters ───────────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new RpcExceptionFilter());

  const port = Number(configService.get('API_GATEWAY_PORT') ?? 3000);
  await app.listen(port);
  console.log(`api-gateway listening on port ${port}`);
}
bootstrap();

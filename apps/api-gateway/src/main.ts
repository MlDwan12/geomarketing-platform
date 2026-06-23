import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from 'redis';
import { RedisStore } from 'connect-redis';
import { join } from 'path';
import { mkdirSync } from 'fs';
import { ApiGatewayModule } from './api-gateway.module';
import { RpcExceptionFilter } from './filters/rpc-exception.filter';
import { HttpExceptionFilter } from './filters/http-exception.filter';
import { ResponseInterceptor } from './interceptors/response.interceptor';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const session = require('express-session');
async function bootstrap() {
  const uploadsDir = join(process.cwd(), 'uploads');
  mkdirSync(uploadsDir, { recursive: true });

  const app = await NestFactory.create<NestExpressApplication>(
    ApiGatewayModule,
    {
      logger: ['log', 'error', 'warn', 'debug'],
    },
  );
  const configService = app.get(ConfigService);
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  app.useStaticAssets(uploadsDir, {
    prefix: '/uploads',
  });

  app.use((req: any, _res: any, next: any) => {
    if (req.method === 'POST' || req.method === 'PATCH') {
      console.log(
        `[DEBUG] ${req.method} ${req.url} | content-type: ${req.headers['content-type']}`,
      );
    }
    next();
  });

  app.use((err, req, res, next) => {
    console.error('GLOBAL ERROR:', err);
    next(err);
  });

  app.use((req: any, res: any, next: any) => {
    const origin = req.headers.origin;
    if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader(
      'Access-Control-Allow-Methods',
      'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    );
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type,Authorization,X-Timezone,X-Brand-Id,ngrok-skip-browser-warning',
    );
    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });

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
      secret:
        configService.get<string>('SESSION_SECRET') ??
        'dev-secret-change-in-prod',
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: 'auto',
        sameSite: 'none',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      },
    }),
  );

  // ── Global pipes, filters & interceptors ────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );
  // порядок важен: RpcExceptionFilter перед HttpExceptionFilter (более специфичный первый)
  app.useGlobalFilters(new HttpExceptionFilter(), new RpcExceptionFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());

  const port = Number(configService.get('API_GATEWAY_PORT') ?? 3000);
  await app.listen(port);
  console.log(`api-gateway listening on port ${port}`);
}
bootstrap();

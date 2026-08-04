import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientProxy } from '@nestjs/microservices';
import { createClient } from 'redis';
import { RedisStore } from 'connect-redis';
import { join } from 'path';
import { mkdirSync } from 'fs';
import { ApiGatewayModule } from './api-gateway.module';
import { RpcExceptionFilter } from './filters/rpc-exception.filter';
import { HttpExceptionFilter } from './filters/http-exception.filter';
import { ResponseInterceptor } from './interceptors/response.interceptor';
import { RequestContext } from '@geo/logger';
import {
  CORRELATION_ID_HEADER,
  resolveCorrelationId,
} from './common/correlation-id';

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

  // Correlation-id: переиспользуем клиентский заголовок или генерируем новый,
  // держим его в AsyncLocalStorage на время запроса (см. libs/logger) и
  // возвращаем тем же заголовком в ответе. Регистрируется первым, чтобы весь
  // последующий код запроса (CORS, сессии, обработчики ошибок, контроллеры)
  // выполнялся внутри этого контекста.
  app.use((req: any, res: any, next: any) => {
    const correlationId = resolveCorrelationId(
      req.headers[CORRELATION_ID_HEADER],
    );
    res.setHeader(CORRELATION_ID_HEADER, correlationId);
    RequestContext.run(correlationId, next);
  });

  app.use((err, req, res, next) => {
    console.error('GLOBAL ERROR:', err);
    if ((res as any).headersSent) return;
    next(err);
  });

  // CORS allowlist: если CORS_ORIGINS задан (список через запятую) — отражаем
  // только разрешённые origin; если не задан — сохраняется прежнее поведение
  // (отражаем любой origin), чтобы не ломать dev.
  const corsOrigins = (configService.get<string>('CORS_ORIGINS') ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  const corsAllowAll = corsOrigins.length === 0;

  app.use((req: any, res: any, next: any) => {
    const origin = req.headers.origin as string | undefined;
    if (origin && (corsAllowAll || corsOrigins.includes(origin))) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }
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

  const nodeEnv = configService.get<string>('NODE_ENV') ?? 'development';
  const sessionSecret = configService.get<string>('SESSION_SECRET');
  if (!sessionSecret && nodeEnv === 'production') {
    throw new Error('SESSION_SECRET is required in production');
  }

  app.use(
    session({
      store: new RedisStore({ client: redisClient as any }),
      secret: sessionSecret ?? 'dev-secret-change-in-prod',
      resave: false,
      saveUninitialized: false,
      rolling: true,
      cookie: {
        httpOnly: true,
        secure: 'auto',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      },
    }),
  );

  // SameSite=None is required for cross-origin HTTPS (production); on HTTP (localhost) use Lax
  // because browsers reject SameSite=None without Secure.
  app.use((req: any, _res: any, next: any) => {
    if (req.session?.cookie) {
      const isSecure = !!(
        req.secure || req.headers['x-forwarded-proto'] === 'https'
      );
      req.session.cookie.sameSite = isSecure ? 'none' : 'lax';
    }
    next();
  });

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

  // Wait for RabbitMQ connection before accepting traffic so the first login
  // request doesn't hit a timeout while the broker is still connecting.
  const coreClient = app.get<ClientProxy>('CORE_SERVICE');
  await coreClient.connect();

  const port = Number(configService.get('API_GATEWAY_PORT') ?? 3000);
  await app.listen(port);
  console.log(`api-gateway listening on port ${port}`);
}
bootstrap();

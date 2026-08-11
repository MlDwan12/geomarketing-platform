import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientProxy } from '@nestjs/microservices';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { createClient } from 'redis';
import { RedisStore } from 'connect-redis';
import { join } from 'path';
import { mkdirSync } from 'fs';
import type { NextFunction, Request, Response } from 'express';
import { ApiGatewayModule } from './api-gateway.module';
import { RpcExceptionFilter } from './filters/rpc-exception.filter';
import { HttpExceptionFilter } from './filters/http-exception.filter';
import { ResponseInterceptor } from './interceptors/response.interceptor';
import {
  CORRELATION_ID_HEADER,
  LoggerService,
  RequestContext,
} from '@geo/logger';
import { resolveCorrelationId } from './common/correlation-id';

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

  const logger = new LoggerService();
  app.useLogger(logger);

  const configService = app.get(ConfigService);
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  app.useStaticAssets(uploadsDir, {
    prefix: '/uploads',
    setHeaders: (res: Response) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
    },
  });

  // Correlation-id: переиспользуем клиентский заголовок или генерируем новый,
  // держим его в AsyncLocalStorage на время запроса (см. libs/logger) и
  // возвращаем тем же заголовком в ответе. Регистрируется первым, чтобы весь
  // последующий код запроса (CORS, сессии, обработчики ошибок, контроллеры)
  // выполнялся внутри этого контекста.
  app.use((req: Request, res: Response, next: NextFunction) => {
    const correlationId = resolveCorrelationId(
      req.headers[CORRELATION_ID_HEADER],
    );
    res.setHeader(CORRELATION_ID_HEADER, correlationId);
    RequestContext.run(correlationId, next);
  });

  app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    logger.error(err, 'GlobalErrorHandler');
    if (res.headersSent) return;
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

  app.use((req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;
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
  redisClient.on('error', (err) => logger.error(err, 'RedisSession'));
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
  app.use((req: Request, _res: Response, next: NextFunction) => {
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

  // ── Swagger (OpenAPI) ────────────────────────────────────────────────────
  // Всегда доступен на /api/docs (внутренний проект, пока нет внешних
  // пользователей — можно закрыть в prod позже, если понадобится).
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Geomarketing Platform API')
    .setDescription(
      'HTTP-API api-gateway для фронтенда. Успешный ответ всегда имеет вид ' +
        '`{ "success": true, "data": ... }` (см. ResponseInterceptor), ошибка — ' +
        '`{ "success": false, "error": { "code", "message", "details?" } }` ' +
        '(см. HttpExceptionFilter/RpcExceptionFilter). Схемы ниже описывают ' +
        'только форму `data`/`error`, без внешнего конверта. Авторизация — ' +
        'сессионная cookie (`connect.sid`), выдаётся `POST /auth/login`; ' +
        'выбор бренда передаётся заголовком `X-Brand-Id`, часовой пояс для ' +
        'форматирования дат в ответе — заголовком `X-Timezone`.',
    )
    .setVersion('0.0.1')
    .addCookieAuth('connect.sid', {
      type: 'apiKey',
      in: 'cookie',
      name: 'connect.sid',
      description: 'Сессионная cookie, выдаётся POST /auth/login',
    })
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, swaggerDocument);

  // Wait for RabbitMQ connection before accepting traffic so the first login
  // request doesn't hit a timeout while the broker is still connecting.
  const coreClient = app.get<ClientProxy>('CORE_SERVICE');
  await coreClient.connect();

  const port = Number(configService.get('API_GATEWAY_PORT') ?? 3000);
  await app.listen(port);
  logger.log(`api-gateway listening on port ${port}`, 'Bootstrap');
}
bootstrap();

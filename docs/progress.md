# Progress — GEO-маркетинг backend

> Монорепо NestJS. api-gateway (HTTP, порт 3000) → RabbitMQ → core-service (порт 3001).  
> ORM: TypeORM. БД: PostgreSQL + Redis (сессии) + RabbitMQ.  
> Все паттерны RabbitMQ — `libs/contracts/src/patterns.ts`.

---

## Статус модулей

| Модуль | Gateway controller | Core service | Статус |
|--------|--------------------|--------------|--------|
| **Auth** | `auth/auth.controller.ts` | `user/`, `password-reset/` | ✅ готово |
| **Brands** | `brands/brands.controller.ts` | `brand/` | ✅ готово |
| Companies | — | — | ⬜ не начато |
| Company card | — | — | ⬜ не начато |
| Company groups | — | — | ⬜ не начато |
| Platforms | — | — | ⬜ не начато |
| Team | — | — | ⬜ не начато |
| Invitations | — | — | ⬜ не начато |
| User profile | — | — | ⬜ не начато |
| Billing | — | — | ⬜ не начато |
| Referrals | — | — | ⬜ не начато |

---

## Что сделано

### Инфраструктура
- Docker Compose: postgres, redis, rabbitmq, все сервисы
- Локальные systemd postgres/redis останавливать перед запуском (`sudo systemctl stop postgresql redis`)
- map-parser: отдельный `Dockerfile.map-parser` (Debian + Playwright), отдельные `DB_HOST/DB_PORT/DB_USER/DB_PASS/DB_NAME` в docker-compose (map-parser не использует `DATABASE_URL`)

### Миграции (core-service)
- `synchronize: false`, `migrationsRun: true` — миграции запускаются автоматически при старте
- Классы миграций импортируются напрямую в `core-service.module.ts` (работает с webpack-бандлом)
- CLI: `yarn migration:generate <path>`, `yarn migration:run`, `yarn migration:revert`
- `tsconfig.migration.json` — CommonJS-режим для ts-node CLI
- `apps/core-service/data-source.ts` — DataSource для CLI

**Выполненные миграции:**
```
1750000000000-Init          — users, password_reset_tokens
1750000001000-AddBrands     — brands, user_brands
```

**Важно про DROP TYPE ... CASCADE:** при дропе enum-типа с CASCADE PostgreSQL удаляет зависимые колонки из таблиц. Не использовать CASCADE при дропе типов если таблица должна остаться.

### TypeORM — типизация nullable-полей
Все `string | null`, `Date | null` поля требуют явного `type` в декораторе — иначе `reflect-metadata` возвращает `Object` и TypeORM падает:
```typescript
@Column({ type: 'varchar', length: 200, nullable: true }) fullName: string | null
@Column({ type: 'text', nullable: true })                 description: string | null
@Column({ type: 'timestamptz', nullable: true })          usedAt: Date | null
@Column({ type: 'timestamp' })                            expiresAt: Date  // не nullable — ок без type
```

### TypeORM — uuid FK-колонки
FK на uuid-первичный ключ должен быть `type: 'uuid'`, иначе PostgreSQL не может сравнить `character varying = uuid`:
```typescript
@Column({ type: 'uuid' }) userId: string
@Column({ type: 'uuid' }) brandId: string
```

### libs/contracts/src/patterns.ts
Все RabbitMQ-паттерны. Brands-паттерны: `BRAND_LIST`, `BRAND_LIST_SHORT`, `BRAND_GET`, `BRAND_CREATE`, `BRAND_UPDATE`.

### libs/config/src/env.validation.ts
`SESSION_SECRET`, `DATABASE_URL`, `REDIS_HOST/PORT` — optional. `RABBITMQ_URL` — required.

### apps/api-gateway/src/main.ts
- `express-session` через `require()` (обход TS1272 с `nodenext + isolatedModules`)
- `RedisStore` — named export из `connect-redis`
- `ValidationPipe` глобально, `RpcExceptionFilter` глобально

### apps/api-gateway/src/ — auth модуль ✅
```
filters/rpc-exception.filter.ts
auth/auth.module.ts             ← регистрирует свой ClientsModule(CORE_SERVICE)
auth/auth.controller.ts         ← login/register/me/logout/forgot/reset/change-password/update-profile/update-avatar
auth/guards/session.guard.ts
auth/decorators/current-user.decorator.ts
auth/dto/                       ← login, register, forgot-password, reset-password, change-password, update-profile, update-avatar
```

### apps/api-gateway/src/ — brands модуль ✅
```
brands/brands.module.ts         ← регистрирует свой ClientsModule(CORE_SERVICE)
brands/brands.controller.ts     ← GET /brands, GET /brands/short, GET /brands/:id, POST /brands, PATCH /brands/:id
brands/dto/create-brand.dto.ts  ← name, timezone, description?, logoUrl?
brands/dto/update-brand.dto.ts  ← все поля optional
```

**Важно:** каждый feature-модуль в gateway регистрирует `ClientsModule.registerAsync(CORE_SERVICE)` самостоятельно — провайдеры не текут вниз по иерархии модулей в NestJS.

### apps/core-service/src/ — user + password-reset ✅
```
user/user.entity.ts         ← passwordHash: { select: false }
user/user.service.ts        ← validate/create/getProfile/updateProfile/updateAvatar/changePassword
user/user.controller.ts
password-reset/password-reset-token.entity.ts
password-reset/password-reset.service.ts   ← SHA-256 хэш; IsNull() из typeorm
password-reset/password-reset.controller.ts
```

### apps/core-service/src/ — brand модуль ✅
```
brand/brand.entity.ts       ← BrandStatus enum, ownerId: uuid
brand/user-brand.entity.ts  ← userId/brandId: uuid, role/status: enum
brand/brand.service.ts      ← list/listShort/get/create/update + slugify (инлайн транслитерация RU→EN)
brand/brand.controller.ts   ← MessagePattern хендлеры
brand/brand.module.ts
```

**Slug:** транслитерация реализована инлайн в `BrandService.slugify()`, без внешних зависимостей. При `create` — slug из name. При `update` с изменением `name` — slug пересчитывается.

**Access control:**
- `list/listShort` — JOIN на `user_brands` по `userId` (видит только свои бренды)
- `get` — проверка `brand.ownerId === userId` ИЛИ запись в `user_brands`
- `update` — только `brand.ownerId === userId`

При создании бренда автоматически создаётся запись в `user_brands` с `role: owner`.

---

## Яндекс интеграция — нужно выяснить перед реализацией

Аналог `TwoGisAccountService` для Яндекса. У 2GIS два потока:
- **Каталог** (публичный) — `getBranchInfo` через `catalog.api.2gis.com`, без авторизации
- **Аккаунт** (приватный) — `updateBranch` через `api.account.2gis.com`, логин + пароль → Bearer token

У Яндекса схема другая — OAuth 2.0. Перед реализацией нужно уточнить:

| Вопрос | Варианты |
|--------|----------|
| API-ключ Яндекс Карт? | Нужен для поиска по каталогу (`search-maps.yandex.ru` / `geocode-maps.yandex.ru`) |
| OAuth-приложение в Яндексе? | `client_id` + `client_secret` — для авторизации через аккаунт пользователя в Яндекс Бизнесе |
| Доступ к Яндекс Справочник API? | `api.sprav.yandex.ru` — B2B, доступ не публичный, нужно отдельное подключение |
| Или Playwright scraping? | Как `auth()` у 2GIS — без официального API, через браузер |

**Начать с этого в следующей сессии** — уточнить у пользователя что из перечисленного есть, и только потом писать код.

---

## Следующий модуль: Companies

### Что нужно реализовать
```
apps/api-gateway/src/companies/
  companies.module.ts
  companies.controller.ts     ← GET /companies, POST /companies, GET /companies/:id
  dto/get-companies.dto.ts    ← page, limit, search, sortKey, sortDirection
  dto/create-company.dto.ts   ← name?, brandId

apps/core-service/src/company/
  company.entity.ts           ← brandId: uuid, status: CompanyStatus enum
  company.service.ts          ← list (пагинация + поиск), create (транзакция: company + card + platforms)
  company.controller.ts
  company.module.ts

apps/core-service/src/company-card/
  company-card.entity.ts      ← JSONB-поля (PlatformField<T>)
  
apps/core-service/src/company-platform/
  company-platform.entity.ts  ← platform: PlatformType enum, status: PlatformStatus enum
```

### Ключевое: как brandId попадает в запрос
После логина в платформе (2GIS, Яндекс и т.п.) пользователь работает в контексте конкретного бренда. `brandId` нужно передавать в каждый запрос к компаниям/платформам.

**Варианты:**
1. **Header `X-Brand-Id`** — gateway читает из заголовка, передаёт в RabbitMQ payload
2. **URL-параметр** — `/brands/:brandId/companies`
3. **Сессия** — хранить `activeBrandId` в сессии, переключать через `POST /brands/:id/switch`

**Принятое решение (из архитектурного гайда):** сессия НЕ хранит `activeBrandId`. Используется **`X-Brand-Id` header** — пользователь всегда явно указывает бренд в запросе. Gateway читает `req.headers['x-brand-id']`, валидирует UUID, передаёт в payload к core-service. Core-service проверяет доступ через `user_brands`.

Сказать: **"продолжай с companies"** чтобы начать следующий модуль.

---

## Ключевые технические решения

### Сессии
- `express-session` + `connect-redis` в api-gateway
- В сессии хранится: `{ userId: string, role: string }` — только эти два поля
- При logout: `session.destroy()` + `res.clearCookie('connect.sid')`
- `SessionGuard` — проверяет `req.session.userId`

### RabbitMQ flow
```
Gateway controller
  → this.coreClient.send(Patterns.XXX, payload).pipe(timeout(5000))
  → firstValueFrom(...)
  → return result / throw HttpException

Core-service controller
  @MessagePattern(Patterns.XXX)
  → calls service
  → returns value / throws new RpcException({ statusCode, message })
```

### Обработка ошибок
- Core throws: `new RpcException({ status: 404, message: '...' })`
- Gateway catches: `RpcExceptionFilter` → `res.status(status).json({ message })`
- Null-ответы → gateway бросает исключение сам (`UnauthorizedException` и т.п.)

### TypeORM — passwordHash
```typescript
@Column({ select: false }) passwordHash: string
// Достать:
this.repo.createQueryBuilder('u').addSelect('u.passwordHash').where(...).getOne()
```

### TypeORM — IsNull() в where
```typescript
import { IsNull } from 'typeorm';
{ usedAt: IsNull() }  // вместо { usedAt: null }
```

### Forgot password
Сейчас: `console.log` с токеном в DEV. Дальше: через mail-service.

---

## Переменные окружения (.env)
```env
NODE_ENV=development
API_GATEWAY_PORT=3000
RABBITMQ_URL=amqp://guest:guest@localhost:5672
REDIS_HOST=localhost
REDIS_PORT=6379
SESSION_SECRET=change-me-in-production
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/geomarketing
CORE_SERVICE_PORT=3001
POSTGRES_DB=geomarketing
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
```

---

## Структура файлов (текущее состояние)

```
apps/
  api-gateway/src/
    main.ts
    api-gateway.module.ts
    types/session.d.ts
    filters/rpc-exception.filter.ts
    auth/           ✅
    brands/         ✅
    companies/      ⬜
    company-groups/ ⬜
    platforms/      ⬜
    team/           ⬜
    user/           ⬜  (profile + avatar)
    billing/        ⬜
    referrals/      ⬜

  core-service/src/
    core-service.module.ts
    data-source.ts          ← TypeORM CLI
    migrations/
      1750000000000-Init.ts       ✅
      1750000001000-AddBrands.ts  ✅
    user/           ✅
    password-reset/ ✅
    brand/          ✅
    company/        ⬜
    company-card/   ⬜
    company-group/  ⬜
    company-platform/ ⬜
    team/           ⬜
    invitation/     ⬜
    billing/        ⬜
    referral/       ⬜

libs/
  contracts/src/
    queues.ts       ✅
    patterns.ts     ✅
  config/src/
    env.validation.ts  ✅
```

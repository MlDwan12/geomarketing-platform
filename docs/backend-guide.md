# Бэкенд-гайд — GEO-маркетинг (NestJS)

> Монорепо: `api-gateway` (HTTP) ↔ RabbitMQ ↔ `core-service` / `review-service` / `integration-service`  
> ORM: TypeORM. БД: PostgreSQL + Redis (сессии) + RabbitMQ (очереди).

---

## Содержание

1. [Как всё работает вместе](#1-как-всё-работает-вместе)
2. [Распределение модулей по сервисам](#2-распределение-модулей-по-сервисам)
3. [Аутентификация и сессии](#3-аутентификация-и-сессии)
4. [TypeORM-сущности](#4-typeorm-сущности)
5. [Модули — что реализовывать](#5-модули--что-реализовывать)
6. [Работа с карточкой компании](#6-работа-с-карточкой-компании)
7. [Файловые загрузки](#7-файловые-загрузки)
8. [Паттерны и соглашения](#8-паттерны-и-соглашения)

---

## 1. Как всё работает вместе

```
Браузер
  │  HTTP (cookie session)
  ▼
api-gateway (порт 3000)
  │  Принимает HTTP, проверяет сессию, валидирует DTO
  │  Отправляет команды/запросы через RabbitMQ
  ├──► core_queue      → core-service     (users, brands, companies, billing, team…)
  ├──► review_queue    → review-service   (отзывы, рейтинг)
  ├──► ai_queue        → ai-service       (AI-фичи)
  └──► integration_queue → integration-service (публикация на Yandex/2GIS)
```

**Один HTTP-запрос = один RabbitMQ-вызов** (через `coreClient.send(pattern, payload)`).  
Gateway не содержит бизнес-логики — только HTTP in/out, сессия, валидация DTO, маршрутизация в нужную очередь.

---

## 2. Распределение модулей по сервисам

| Модуль | api-gateway | core-service | integration-service | review-service |
|--------|-------------|--------------|---------------------|----------------|
| Auth | Controller + Session guard | UserModule (поиск/создание пользователя, смена пароля) | — | — |
| Brands | Controller + DTO | BrandModule | — | — |
| Companies | Controller + DTO | CompanyModule | — | — |
| Company groups | Controller + DTO | CompanyGroupModule | — | — |
| Company card | Controller + DTO | CompanyCardModule | — | — |
| Platforms summary | Controller | — | PlatformSummaryModule | — |
| Company platforms | Controller | CompanyPlatformModule (статус) | PlatformConnectModule (подключение/синхронизация) | — |
| Team | Controller + DTO | TeamModule | — | — |
| Invitations | Controller + DTO | InvitationModule | — | — |
| User profile | Controller + DTO | UserModule | — | — |
| Billing | Controller | BillingModule | — | — |
| Referrals | Controller | ReferralModule | — | — |

---

## 3. Аутентификация и сессии

### Стек
- `express-session` — сессионная middleware в api-gateway
- `connect-redis` — хранилище сессий в Redis
- Никаких JWT, никаких токенов в теле ответа

### Установка зависимостей (в api-gateway)
```bash
yarn add express-session connect-redis ioredis
yarn add -D @types/express-session
```

### main.ts — подключение сессии
```typescript
// apps/api-gateway/src/main.ts
import * as session from 'express-session';
import { createClient } from 'redis';
import RedisStore from 'connect-redis';

async function bootstrap() {
  const app = await NestFactory.create(ApiGatewayModule);

  const redisClient = createClient({
    socket: {
      host: configService.get('REDIS_HOST'),
      port: configService.get<number>('REDIS_PORT'),
    },
  });
  await redisClient.connect();

  app.use(
    session({
      store: new RedisStore({ client: redisClient }),
      secret: configService.get('SESSION_SECRET'),
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 дней
      },
    }),
  );

  await app.listen(port);
}
```

### Что кладём в сессию
```typescript
// При успешном логине:
req.session['userId'] = user.id;
req.session['role'] = user.role;
req.session['currentBrandId'] = null; // будет выставляться при переключении бренда
```

### SessionGuard — защита роутов
```typescript
// libs/common/src/guards/session.guard.ts
@Injectable()
export class SessionGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    if (!req.session?.userId) {
      throw new UnauthorizedException();
    }
    return true;
  }
}
```

Применять глобально в api-gateway, исключая `/auth/login`, `/auth/register`, `/auth/forgot-password`, `/auth/reset-password`.

### Декоратор для текущего пользователя
```typescript
// libs/common/src/decorators/current-user.decorator.ts
export const CurrentUser = createParamDecorator(
  (_, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest();
    return { userId: req.session.userId, role: req.session.role };
  },
);
```

---

## 4. TypeORM-сущности

Все сущности живут в `core-service`. Можно вынести в `libs/common/src/entities/` для переиспользования в других сервисах.

### Enum-типы
```typescript
// libs/common/src/enums/index.ts
export enum UserRole { Owner = 'owner', Admin = 'admin', Manager = 'manager', Viewer = 'viewer' }
export enum UserStatus { Active = 'active', Suspended = 'suspended', Left = 'left', Pending = 'pending' }
export enum BrandStatus { Active = 'active', Suspended = 'suspended', Deleted = 'deleted' }
export enum CompanyStatus { Draft = 'draft', Active = 'active', TemporarilyClosed = 'temporarily_closed', Suspended = 'suspended', Deleted = 'deleted' }
export enum PlatformType { Yandex = 'yandex', TwoGis = 'twogis' }
export enum PlatformStatus { NotConnected = 'not_connected', Connected = 'connected', Pending = 'pending', ActionRequired = 'action_required', Disconnected = 'disconnected', Error = 'error' }
export enum SubStatus { Trial = 'trial', Active = 'active', Expiring = 'expiring', PastDue = 'past_due', Expired = 'expired', None = 'none' }
export enum AddonStatus { Active = 'active', Expiring = 'expiring', Expired = 'expired' }
export enum InviteStatus { Active = 'active', Revoked = 'revoked', Exhausted = 'exhausted' }
export enum ReferralStatus { Pending = 'pending', Confirmed = 'confirmed', BonusPaid = 'bonus_paid', Cancelled = 'cancelled' }
```

### User
```typescript
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ length: 100 }) name: string;
  @Column({ length: 200, nullable: true }) fullName: string | null;
  @Column({ length: 254, unique: true }) email: string;
  @Column() passwordHash: string;
  @Column({ type: 'enum', enum: UserRole, default: UserRole.Owner }) role: UserRole;
  @Column({ type: 'enum', enum: UserStatus, default: UserStatus.Active }) status: UserStatus;
  @Column({ length: 30, nullable: true }) phone: string | null;
  @Column({ length: 64, nullable: true }) telegram: string | null;
  @Column({ default: false }) twoFaEnabled: boolean;
  @Column({ length: 500, nullable: true }) avatarUrl: string | null;
  @Column({ length: 64, nullable: true }) timezone: string | null;
  @Column({ length: 10, nullable: true }) locale: string | null;
  @Column({ length: 32, unique: true, nullable: true }) refCode: string | null;
  @Column({ nullable: true }) referredById: string | null;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
```

### Brand
```typescript
@Entity('brands')
export class Brand {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ length: 100 }) name: string;
  @Column({ length: 120, unique: true }) slug: string;
  @Column() ownerId: string;
  @Column({ type: 'enum', enum: BrandStatus, default: BrandStatus.Active }) status: BrandStatus;
  @Column({ length: 64 }) timezone: string;
  @Column({ type: 'text', nullable: true }) description: string | null;
  @Column({ length: 500, nullable: true }) logoUrl: string | null;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;

  @OneToOne(() => Subscription, (s) => s.brand) subscription: Subscription;
  @OneToMany(() => Company, (c) => c.brand) companies: Company[];
  @OneToMany(() => CompanyGroup, (g) => g.brand) groups: CompanyGroup[];
}
```

### Company
```typescript
@Entity('companies')
export class Company {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() brandId: string;
  @ManyToOne(() => Brand, (b) => b.companies) brand: Brand;
  @Column({ length: 255 }) name: string;
  @Column({ length: 300, unique: true }) slug: string;
  @Column({ type: 'enum', enum: CompanyStatus, default: CompanyStatus.Draft }) status: CompanyStatus;
  @Column({ length: 50, nullable: true }) code: string | null;
  @Column({ type: 'text', nullable: true }) addressDisplay: string | null;
  @Column({ type: 'numeric', precision: 3, scale: 1, nullable: true }) rating: number | null;
  @Column({ default: 0 }) reviewCount: number;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;

  @OneToOne(() => CompanyCard, (c) => c.company) card: CompanyCard;
  @OneToMany(() => CompanyPlatform, (p) => p.company) platforms: CompanyPlatform[];
  @ManyToMany(() => CompanyGroup, (g) => g.companies)
  @JoinTable({ name: 'company_group_members', joinColumn: { name: 'company_id' }, inverseJoinColumn: { name: 'group_id' } })
  groups: CompanyGroup[];
}
```

### CompanyCard — карточка компании
```typescript
// Интерфейсы для JSONB-полей
export interface PlatformField<T> {
  default: T;
  platforms?: { yandex?: T; twogis?: T };
  isException?: boolean;
}
export interface LocalizedValue { lang: string; val: string; }
export interface Phone { phone: string; description?: string; ext?: string; hidden?: boolean; }
export interface Address { country?: string; region?: string; city?: string; postalCode?: string; street?: string; building?: string; comment?: string; lat?: string; lon?: string; }
export interface Website { type: string; url: string; }
export interface Category { id: string; name: string; }
export interface DaySchedule { closed: boolean; from?: string; to?: string; }
export interface WeekSchedule { mon: DaySchedule; tue: DaySchedule; wed: DaySchedule; thu: DaySchedule; fri: DaySchedule; sat: DaySchedule; sun: DaySchedule; }
export interface SpecialDay { date: string; closed: boolean; from?: string; to?: string; }

@Entity('company_cards')
export class CompanyCard {
  @PrimaryColumn() companyId: string;
  @OneToOne(() => Company, (c) => c.card)
  @JoinColumn({ name: 'company_id' })
  company: Company;

  // Каждое поле = отдельная JSONB-колонка
  @Column({ type: 'jsonb', nullable: true }) names: PlatformField<LocalizedValue[]> | null;
  @Column({ type: 'jsonb', nullable: true }) shortNames: PlatformField<LocalizedValue[]> | null;
  @Column({ type: 'jsonb', nullable: true }) altNames: PlatformField<{ val: string }[]> | null;
  @Column({ type: 'jsonb', nullable: true }) email: PlatformField<string> | null;
  @Column({ type: 'jsonb', nullable: true }) phones: PlatformField<Phone[]> | null;
  @Column({ type: 'jsonb', nullable: true }) address: PlatformField<Address> | null;
  @Column({ type: 'jsonb', nullable: true }) websites: PlatformField<Website[]> | null;
  @Column({ type: 'jsonb', nullable: true }) socials: PlatformField<Website[]> | null;
  @Column({ type: 'jsonb', nullable: true }) mainCategory: PlatformField<Category> | null;
  @Column({ type: 'jsonb', nullable: true }) additionalCategories: PlatformField<Category[]> | null;
  @Column({ type: 'jsonb', nullable: true }) descriptions: PlatformField<LocalizedValue[]> | null;
  @Column({ type: 'jsonb', nullable: true }) shortDescriptions: PlatformField<LocalizedValue[]> | null;
  @Column({ type: 'jsonb', nullable: true }) schedule: WeekSchedule | null;
  @Column({ type: 'jsonb', nullable: true }) specialDays: SpecialDay[] | null;

  @UpdateDateColumn() updatedAt: Date;
}
```

### CompanyPlatform
```typescript
@Entity('company_platforms')
@Unique(['companyId', 'platform'])
export class CompanyPlatform {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() companyId: string;
  @ManyToOne(() => Company, (c) => c.platforms) company: Company;
  @Column({ type: 'enum', enum: PlatformType }) platform: PlatformType;
  @Column({ type: 'enum', enum: PlatformStatus, default: PlatformStatus.NotConnected }) status: PlatformStatus;
  @Column({ default: false }) isEnabled: boolean;
  @Column({ length: 100, nullable: true }) orgId: string | null;
  @Column({ length: 255, nullable: true }) orgName: string | null;
  @Column({ nullable: true }) connectedAt: Date | null;
  @Column({ nullable: true }) lastSyncAt: Date | null;
  @Column({ type: 'text', nullable: true }) syncError: string | null;
}
```

### UserBrand (команда)
```typescript
@Entity('user_brands')
@Unique(['userId', 'brandId'])
export class UserBrand {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() userId: string;
  @Column() brandId: string;
  @Column({ type: 'enum', enum: UserRole }) role: UserRole;
  @Column({ type: 'enum', enum: UserStatus, default: UserStatus.Active }) status: UserStatus;
  @CreateDateColumn() joinedAt: Date;
  @Column({ nullable: true }) lastLoginAt: Date | null;
}
```

### Invitation
```typescript
@Entity('invitations')
export class Invitation {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() brandId: string;
  @Column({ length: 254, nullable: true }) email: string | null;
  @Column({ type: 'enum', enum: UserRole }) role: UserRole;
  @Column() createdById: string;
  @Column({ type: 'enum', enum: InviteStatus, default: InviteStatus.Active }) status: InviteStatus;
  @Column() expiresAt: Date;
  @Column({ nullable: true }) acceptedById: string | null;
  @Column({ nullable: true }) acceptedAt: Date | null;
  @CreateDateColumn() createdAt: Date;
}
```

### Subscription + SubscriptionAddon
```typescript
@Entity('subscriptions')
export class Subscription {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ unique: true }) brandId: string;
  @OneToOne(() => Brand) @JoinColumn({ name: 'brand_id' }) brand: Brand;
  @Column() planId: string;
  @ManyToOne(() => Plan) plan: Plan;
  @Column({ type: 'enum', enum: SubStatus }) status: SubStatus;
  @Column({ nullable: true }) trialEndsAt: Date | null;
  @Column({ nullable: true }) renewsAt: Date | null;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;

  @OneToMany(() => SubscriptionAddon, (a) => a.subscription) addons: SubscriptionAddon[];
}

@Entity('subscription_addons')
export class SubscriptionAddon {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() subscriptionId: string;
  @ManyToOne(() => Subscription, (s) => s.addons) subscription: Subscription;
  @Column() addonId: string;
  @ManyToOne(() => Addon) addon: Addon;
  @Column({ type: 'enum', enum: AddonStatus }) status: AddonStatus;
  @Column({ nullable: true }) expiresAt: Date | null;
  @Column({ nullable: true }) limitUsed: number | null;
  @Column({ nullable: true }) limitTotal: number | null;
  @Column({ length: 50, nullable: true }) limitUnit: string | null;
}
```

---

## 5. Модули — что реализовывать

### Соглашение по RabbitMQ-паттернам

```typescript
// libs/contracts/src/patterns.ts
export const Patterns = {
  // Auth / Users
  USER_FIND_BY_EMAIL:    'user.findByEmail',
  USER_CREATE:           'user.create',
  USER_GET_PROFILE:      'user.getProfile',
  USER_UPDATE_PROFILE:   'user.updateProfile',
  USER_UPDATE_AVATAR:    'user.updateAvatar',
  USER_CHANGE_PASSWORD:  'user.changePassword',
  USER_VALIDATE_PASSWORD:'user.validatePassword',

  // Password reset
  PWD_RESET_CREATE:      'passwordReset.create',
  PWD_RESET_CONSUME:     'passwordReset.consume',

  // Brands
  BRAND_LIST:            'brand.list',
  BRAND_LIST_SHORT:      'brand.listShort',
  BRAND_GET:             'brand.get',
  BRAND_CREATE:          'brand.create',
  BRAND_UPDATE:          'brand.update',

  // Companies
  COMPANY_LIST:          'company.list',
  COMPANY_CREATE:        'company.create',
  COMPANY_GET_CARD:      'company.getCard',
  COMPANY_UPDATE_CARD:   'company.updateCard',

  // Company groups
  GROUP_LIST:            'companyGroup.list',
  GROUP_CREATE:          'companyGroup.create',
  GROUP_UPDATE:          'companyGroup.update',
  GROUP_DELETE:          'companyGroup.delete',
  GROUP_MEMBER_REMOVE:   'companyGroup.removeMember',

  // Platforms
  PLATFORM_GET:          'platform.get',
  PLATFORM_CONNECT:      'platform.connect',
  PLATFORM_DISCONNECT:   'platform.disconnect',
  PLATFORM_SUMMARY:      'platform.summary',

  // Team
  TEAM_LIST_USERS:       'team.listUsers',
  TEAM_INVITE:           'team.invite',
  TEAM_INVITATION_LIST:  'team.invitationList',
  TEAM_INVITATION_REVOKE:'team.invitationRevoke',

  // Billing
  BILLING_SUMMARY:       'billing.summary',

  // Referrals
  REFERRAL_LIST:         'referral.list',
} as const;
```

---

### AuthModule (api-gateway)

**Что делает:** принимает HTTP, управляет сессией, запрашивает данные у core-service.

```
POST /auth/login
  → coreClient.send(USER_FIND_BY_EMAIL, { email })
  → если нет — 401
  → coreClient.send(USER_VALIDATE_PASSWORD, { hash, password })
  → req.session.userId = user.id → return UserDto

POST /auth/register
  → coreClient.send(USER_FIND_BY_EMAIL) → если есть — 409
  → coreClient.send(USER_CREATE, { name, email, passwordHash: hash(password) })
  → req.session.userId = user.id → return UserDto (201)

POST /auth/forgot-password
  → coreClient.send(USER_FIND_BY_EMAIL) — игнорируем результат
  → если есть: coreClient.send(PWD_RESET_CREATE, { userId }) → отправляем email
  → всегда 200

POST /auth/reset-password
  → coreClient.send(PWD_RESET_CONSUME, { token, newPasswordHash })
  → 400 если токен плохой, иначе 200

GET /auth/me
  → если нет сессии — 401
  → coreClient.send(USER_GET_PROFILE, { userId: session.userId })

POST /auth/logout
  → req.session.destroy() → 200

PATCH /auth/password
  → coreClient.send(USER_VALIDATE_PASSWORD, { userId, password: currentPassword })
  → 400 если неверный
  → coreClient.send(USER_CHANGE_PASSWORD, { userId, newPasswordHash })
```

---

### BrandModule

**Gateway — controller:**
```typescript
@Controller('brands')
@UseGuards(SessionGuard)
export class BrandController {
  @Get()         // GET /brands
  @Get('short')  // GET /brands/short
  @Get(':id')    // GET /brands/:id
  @Post()        // POST /brands (multipart)
  @Patch(':id')  // PATCH /brands/:id (multipart)
}
```

**Нюанс:** бренды фильтруются по `userId` — пользователь видит только те бренды, участником которых является (`user_brands`). Core-service получает `userId` из payload и делает JOIN или подзапрос.

**Core-service handler:**
```typescript
@MessagePattern(Patterns.BRAND_LIST)
async list({ userId }: { userId: string }) {
  // SELECT brands.* FROM brands
  // JOIN user_brands ON user_brands.brand_id = brands.id
  // WHERE user_brands.user_id = $userId
  // + LEFT JOIN subscriptions для plan info
}
```

---

### CompanyModule

**GET /companies — пагинация + поиск:**

```typescript
// DTO для query params
export class GetCompaniesDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number = 10;
  @IsOptional() @IsString() search?: string;
  @IsOptional() sortKey?: string;
  @IsOptional() @IsIn(['asc', 'desc']) sortDirection?: 'asc' | 'desc';
}
```

```typescript
// Core-service: поиск по name через полнотекстовый индекс
const qb = this.companyRepo.createQueryBuilder('c')
  .where('c.brand_id = :brandId', { brandId })
  .leftJoinAndSelect('c.platforms', 'platforms');

if (search) {
  qb.andWhere("to_tsvector('russian', c.name) @@ plainto_tsquery('russian', :search)", { search });
}

const [data, total] = await qb
  .skip((page - 1) * limit)
  .take(limit)
  .getManyAndCount();
```

**POST /companies — создание:**
1. Создаём запись в `companies` (status: draft)
2. Создаём пустую запись в `company_cards`
3. Создаём по одной записи в `company_platforms` для каждой платформы (status: not_connected)

```typescript
async create(dto: CreateCompanyDto, brandId: string) {
  return this.dataSource.transaction(async (em) => {
    const company = em.create(Company, {
      brandId,
      name: dto.name ?? 'Новая компания',
      slug: await this.generateSlug(dto.name),
      status: CompanyStatus.Draft,
    });
    await em.save(company);

    await em.save(CompanyCard, { companyId: company.id });

    await em.save([
      em.create(CompanyPlatform, { companyId: company.id, platform: PlatformType.Yandex }),
      em.create(CompanyPlatform, { companyId: company.id, platform: PlatformType.TwoGis }),
    ]);

    return company;
  });
}
```

---

### CompanyGroupModule

**Важно:** `DELETE /company-groups/:id` — не трогает компании, только удаляет группу. `company_group_members` чистится каскадом через FK.

**`DELETE /company-group-members?groupId=&companyId=`:**
```typescript
await this.memberRepo.delete({ groupId, companyId });
```

---

### PlatformModule

**GET /companies/:companyId/platforms** — всегда возвращает все платформы (даже not_connected):
```typescript
const platforms = await this.platformRepo.find({ where: { companyId } });
// Если записей нет (компания только создана без транзакции) — это баг, должны создаваться в POST /companies
return platforms;
```

**GET /platforms/summary** — агрегация по бренду:
```typescript
const result = await this.platformRepo
  .createQueryBuilder('cp')
  .select('cp.platform', 'platform')
  .addSelect('COUNT(*)', 'total')
  .addSelect("COUNT(*) FILTER (WHERE cp.status = 'connected')", 'connected')
  .addSelect("COUNT(*) FILTER (WHERE cp.status = 'not_connected')", 'notConnected')
  .addSelect("COUNT(*) FILTER (WHERE cp.status = 'error')", 'error')
  .addSelect("COUNT(*) FILTER (WHERE cp.status = 'action_required')", 'actionRequired')
  .addSelect("COUNT(*) FILTER (WHERE cp.status = 'pending')", 'pending')
  .addSelect("COUNT(*) FILTER (WHERE cp.status = 'disconnected')", 'disconnected')
  .innerJoin(Company, 'c', 'c.id = cp.company_id')
  .where('c.brand_id = :brandId', { brandId })
  .groupBy('cp.platform')
  .getRawMany();
```

---

### TeamModule

**GET /team/users** — список участников с JOIN на users:
```typescript
const members = await this.userBrandRepo
  .createQueryBuilder('ub')
  .innerJoinAndSelect('ub.user', 'u')
  .where('ub.brand_id = :brandId', { brandId })
  .getMany();
```

**POST /team/invite:**
- Проверить `role !== 'owner'`
- Создать `Invitation` с `expiresAt = now() + expiresIn hours`
- Отправить email (через очередь или напрямую)

---

### BillingModule

**GET /billing/summary:**
```typescript
const subscription = await this.subscriptionRepo.findOne({
  where: { brandId },
  relations: ['plan', 'addons', 'addons.addon'],
});
```

Маппинг в ответ API:
```typescript
{
  plan: {
    name: subscription.plan.name,
    price: subscription.plan.price,
    period: subscription.plan.period,
    status: subscription.status,
    renewsAt: subscription.renewsAt,
    features: subscription.plan.features,
  },
  addons: subscription.addons.map(a => ({
    id: a.id,
    name: a.addon.name,
    status: a.status,
    expiresAt: a.expiresAt,
    limit: a.limitTotal != null ? {
      used: a.limitUsed,
      total: a.limitTotal,
      unit: a.limitUnit,
    } : null,
  })),
}
```

---

## 6. Работа с карточкой компании

### GET /companies/:id/data

```typescript
const card = await this.cardRepo.findOne({ where: { companyId: id } });
if (!card) throw new NotFoundException();

// Вернуть CompanyFormData
// groups берём отдельно через company_group_members
const groups = await this.groupRepo
  .createQueryBuilder('g')
  .innerJoin('company_group_members', 'cgm', 'cgm.group_id = g.id')
  .where('cgm.company_id = :companyId', { companyId: id })
  .select(['g.id', 'g.name'])
  .getMany();

return { ...card, groups };
```

### PATCH /companies/:id/data

Это самый сложный эндпоинт. Делаем:

1. **Обновляем `company_cards`** — только переданные поля (partial update):
```typescript
await this.cardRepo.update({ companyId: id }, {
  ...(dto.names !== undefined && { names: dto.names }),
  ...(dto.phones !== undefined && { phones: dto.phones }),
  // ... и т.д. для каждого поля
  updatedAt: new Date(),
});
```

2. **Синхронизируем денормализованные поля в `companies`:**
```typescript
const updates: Partial<Company> = {};

if (dto.names?.default?.[0]?.val) {
  updates.name = dto.names.default[0].val;
  updates.slug = await this.generateSlug(dto.names.default[0].val, id);
}

if (dto.address?.default) {
  const a = dto.address.default;
  updates.addressDisplay = [a.city, a.street, a.building].filter(Boolean).join(', ');
}

if (Object.keys(updates).length > 0) {
  await this.companyRepo.update({ id }, updates);
}
```

3. **Обновляем группы** (если `dto.groups` передан):
```typescript
if (dto.groups !== undefined) {
  await this.memberRepo.delete({ companyId: id });
  if (dto.groups.length > 0) {
    await this.memberRepo.insert(
      dto.groups.map(g => ({ companyId: id, groupId: g.id }))
    );
  }
}
```

Всё это — в одной транзакции.

### Генерация PlatformField для публикации

При публикации на платформу — резолвим значение поля:
```typescript
function resolveField<T>(
  field: PlatformField<T> | null,
  platform: PlatformType,
  brandDefault?: T,
): T | undefined {
  if (!field) return brandDefault;
  if (!field.isException) return brandDefault ?? field.default;
  return field.platforms?.[platform] ?? field.default;
}
```

---

## 7. Файловые загрузки

Загрузка файлов обрабатывается в **api-gateway** — файл туда прилетает, заливается в CDN/S3, а URL уже идёт в core-service.

### Установка
```bash
yarn add multer @types/multer
```

### Controller
```typescript
@Post()
@UseInterceptors(FileInterceptor('logo'))
async createBrand(
  @Body() dto: CreateBrandDto,
  @UploadedFile(
    new ParseFilePipeBuilder()
      .addFileTypeValidator({ fileType: /(jpg|jpeg|png|svg|webp)$/ })
      .addMaxSizeValidator({ maxSize: 2 * 1024 * 1024 }) // 2 МБ
      .build({ fileIsRequired: false }),
  )
  logo?: Express.Multer.File,
) {
  const logoUrl = logo ? await this.fileService.upload(logo) : null;
  return this.coreClient.send(Patterns.BRAND_CREATE, { ...dto, logoUrl });
}
```

### FileService (api-gateway)
```typescript
@Injectable()
export class FileService {
  async upload(file: Express.Multer.File): Promise<string> {
    // Вариант 1: локальная папка (dev)
    const filename = `${uuid()}-${file.originalname}`;
    const dest = path.join('./uploads', filename);
    await fs.writeFile(dest, file.buffer);
    return `/uploads/${filename}`;

    // Вариант 2: S3 (prod)
    // return this.s3Service.upload(file);
  }
}
```

Для `PATCH /brands/:id` — аналогично, но `logo` опционален и передаётся только если пользователь выбрал новый файл.

---

## 8. Паттерны и соглашения

### DTO — валидация на gateway

```typescript
// Пример для создания бренда
export class CreateBrandDto {
  @IsString() @MaxLength(100) name: string;
  @IsString() @IsTimeZone() timezone: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
}
```

Включить глобально в api-gateway:
```typescript
app.useGlobalPipes(new ValidationPipe({
  whitelist: true,      // стрипаем лишние поля
  forbidNonWhitelisted: false,
  transform: true,      // авто-трансформация типов (@Type)
}));
```

### Передача контекста в core-service

Каждый payload включает `userId` и `brandId` — core-service использует их для проверки прав:

```typescript
// Gateway
return firstValueFrom(
  this.coreClient.send(Patterns.BRAND_GET, {
    id,
    userId: currentUser.userId,
  })
);

// Core-service
@MessagePattern(Patterns.BRAND_GET)
async get({ id, userId }: { id: string; userId: string }) {
  // Проверяем что userId является участником этого бренда
  const membership = await this.userBrandRepo.findOne({ where: { userId, brandId: id } });
  if (!membership) throw new RpcException({ statusCode: 403, message: 'Forbidden' });
  return this.brandRepo.findOne({ where: { id }, relations: ['subscription', 'subscription.plan'] });
}
```

### Обработка RPC-ошибок в gateway

```typescript
// libs/common/src/filters/rpc-exception.filter.ts
@Catch(RpcException)
export class RpcExceptionFilter implements ExceptionFilter {
  catch(exception: RpcException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const err = exception.getError() as { statusCode: number; message: string };
    res.status(err.statusCode ?? 500).json({ message: err.message });
  }
}
```

### Slug-генерация

```typescript
import { transliterate } from 'transliteration'; // или custom

function generateSlug(name: string): string {
  return transliterate(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
```

### Пагинация — стандартный ответ

```typescript
export class PaginatedResponseDto<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
```

### Миграции TypeORM

```bash
# Создать
yarn typeorm migration:create apps/core-service/src/migrations/CreateUsers

# Запустить
yarn typeorm migration:run -d apps/core-service/src/data-source.ts
```

```typescript
// apps/core-service/src/data-source.ts
export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [__dirname + '/**/*.entity.{ts,js}'],
  migrations: [__dirname + '/migrations/*.{ts,js}'],
});
```

### Порядок реализации (рекомендуемый)

1. **Entities + миграции** — создать все таблицы
2. **Auth** — login/register/me/logout (всё остальное заблокировано без сессии)
3. **Brands** — CRUD (нужен для контекста бренда во всех остальных модулях)
4. **Companies** — list/create (без карточки)
5. **Company card** — GET + PATCH /data (самый сложный)
6. **Company groups** — CRUD + members
7. **Platforms** — connect/disconnect/summary
8. **Team** — users/invite/invitations
9. **User profile** — GET/PATCH/avatar
10. **Billing** — GET summary (read-only, данные вносятся вручную или биллинг-сервисом)
11. **Referrals** — GET list

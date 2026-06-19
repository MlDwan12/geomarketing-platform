# Структура БД — GEO-маркетинг

> PostgreSQL. Все `id` — UUID v4. Временны́е метки — `TIMESTAMPTZ`.

---

## Содержание

1. [ENUM-типы](#1-enum-типы)
2. [Пользователи и аутентификация](#2-пользователи-и-аутентификация)
3. [Бренды и подписки](#3-бренды-и-подписки)
4. [Команда — участники и приглашения](#4-команда--участники-и-приглашения)
5. [Рефералы](#5-рефералы)
6. [Компании — базовые данные](#6-компании--базовые-данные)
7. [Карточки компаний (CompanyFormData)](#7-карточки-компаний-companyformdata)
8. [Платформы](#8-платформы)
9. [Индексы](#9-индексы)
10. [ER-диаграмма](#10-er-диаграмма)

---

## 1. ENUM-типы

**Что:** именованные множества допустимых значений для статусных полей.

**Почему ENUM, а не VARCHAR:**
- PostgreSQL проверяет значения на уровне БД — невозможно записать невалидный статус.
- Занимают меньше места (4 байта vs строка).
- При смене значения достаточно одной миграции `ALTER TYPE` вместо `UPDATE` по всей таблице.
- Самодокументируются: смотришь на тип — сразу видишь допустимые значения.

```sql
CREATE TYPE user_role        AS ENUM ('owner', 'admin', 'manager', 'viewer');
CREATE TYPE user_status      AS ENUM ('active', 'suspended', 'left', 'pending');
CREATE TYPE brand_status     AS ENUM ('active', 'suspended', 'deleted');
CREATE TYPE company_status   AS ENUM ('draft', 'active', 'temporarily_closed', 'suspended', 'deleted');
CREATE TYPE platform_type    AS ENUM ('yandex', 'twogis');
CREATE TYPE platform_status  AS ENUM ('not_connected', 'connected', 'pending', 'action_required', 'disconnected', 'error');
CREATE TYPE sub_status       AS ENUM ('trial', 'active', 'expiring', 'past_due', 'expired', 'none');
CREATE TYPE addon_status     AS ENUM ('active', 'expiring', 'expired');
CREATE TYPE invite_status    AS ENUM ('active', 'revoked', 'exhausted');
CREATE TYPE referral_status  AS ENUM ('pending', 'confirmed', 'bonus_paid', 'cancelled');
```

---

## 2. Пользователи и аутентификация

### `users` — учётные записи

**Что хранит:** базовые данные всех пользователей системы: email, хэш пароля, профиль, роль.

**Ключевые решения:**

- **`role` здесь — глобальная роль в системе** (например, `admin` может видеть все бренды). Роль пользователя *внутри конкретного бренда* хранится отдельно в `user_brands`. Один и тот же пользователь может быть `owner` одного бренда и `manager` другого.

- **`password_hash`** — никогда не хранится открытый пароль. Используется bcrypt или argon2. При входе сравниваем хэш.

- **`ref_code`** — уникальный код пользователя для реферальной ссылки вида `https://geo.app/ref/<ref_code>`. Генерируется при регистрации.

- **`referred_by_id`** — внешний ключ на себя же (`users`). Показывает, чья реферальная ссылка использовалась при регистрации. `NULL` = зарегистрировался самостоятельно.

| Колонка | Тип | Ограничения | Описание |
|---------|-----|-------------|----------|
| `id` | UUID | PK | |
| `name` | VARCHAR(100) | NOT NULL | Отображаемое имя |
| `full_name` | VARCHAR(200) | NULL | Полное ФИО (из профиля) |
| `email` | VARCHAR(254) | NOT NULL, UNIQUE | Макс. длина email по RFC |
| `password_hash` | VARCHAR(255) | NOT NULL | bcrypt / argon2 |
| `role` | user_role | NOT NULL, default 'owner' | Глобальная роль |
| `status` | user_status | NOT NULL, default 'active' | |
| `phone` | VARCHAR(30) | NULL | |
| `telegram` | VARCHAR(64) | NULL | @handle |
| `two_fa_enabled` | BOOLEAN | NOT NULL, default false | |
| `avatar_url` | VARCHAR(500) | NULL | CDN-ссылка |
| `timezone` | VARCHAR(64) | NULL | IANA, напр. `Europe/Moscow` |
| `locale` | VARCHAR(10) | NULL | `ru`, `en` |
| `ref_code` | VARCHAR(32) | UNIQUE | Код реферальной ссылки |
| `referred_by_id` | UUID | FK users(id), NULL | Кто пригласил |
| `created_at` | TIMESTAMPTZ | NOT NULL, default now() | |
| `updated_at` | TIMESTAMPTZ | NOT NULL, default now() | |

```sql
CREATE TABLE users (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name           VARCHAR(100) NOT NULL,
  full_name      VARCHAR(200),
  email          VARCHAR(254) NOT NULL UNIQUE,
  password_hash  VARCHAR(255) NOT NULL,
  role           user_role    NOT NULL DEFAULT 'owner',
  status         user_status  NOT NULL DEFAULT 'active',
  phone          VARCHAR(30),
  telegram       VARCHAR(64),
  two_fa_enabled BOOLEAN      NOT NULL DEFAULT false,
  avatar_url     VARCHAR(500),
  timezone       VARCHAR(64),
  locale         VARCHAR(10),
  ref_code       VARCHAR(32)  UNIQUE,
  referred_by_id UUID         REFERENCES users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);
```

---

### `sessions` — активные сессии

**Что хранит:** одну строку на каждую активную сессию пользователя (вкладку браузера / устройство).

**Почему отдельная таблица, а не JWT:**
- Cookie с `httpOnly` нельзя прочитать из JavaScript — защита от XSS.
- Серверная сессия позволяет мгновенно инвалидировать доступ (logout, блокировка пользователя) без ожидания истечения токена.
- Можно видеть все активные сессии пользователя и завершать конкретные.

**`token_hash` вместо `token`:** в cookie браузеру отдаётся оригинальное значение токена. В БД хранится только его SHA-256 хэш. Если злоумышленник получит доступ к БД — он увидит только хэши, которые нельзя использовать напрямую.

**`ON DELETE CASCADE`:** при удалении пользователя все его сессии удаляются автоматически.

| Колонка | Тип | Описание |
|---------|-----|----------|
| `id` | UUID | PK |
| `user_id` | UUID | FK users(id), ON DELETE CASCADE |
| `token_hash` | VARCHAR(255) | UNIQUE — SHA-256 от значения в cookie |
| `ip_address` | INET | NULL — для аудита/безопасности |
| `user_agent` | TEXT | NULL — браузер/устройство |
| `expires_at` | TIMESTAMPTZ | NOT NULL |
| `created_at` | TIMESTAMPTZ | NOT NULL, default now() |

```sql
CREATE TABLE sessions (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  VARCHAR(255) NOT NULL UNIQUE,
  ip_address  INET,
  user_agent  TEXT,
  expires_at  TIMESTAMPTZ  NOT NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);
```

---

### `password_reset_tokens` — токены сброса пароля

**Что хранит:** одноразовые токены из писем «забыл пароль».

**Почему `used_at` вместо удаления записи:**
- Аудит: можно видеть, когда токен был использован.
- Защита от повторного использования: запись остаётся, и при попытке повторно применить тот же токен — видим, что `used_at IS NOT NULL`, отклоняем.

**Логика на сервере:** при использовании — проверяем `expires_at > now()` и `used_at IS NULL`. Если ок — обновляем пароль и ставим `used_at = now()`.

| Колонка | Тип | Описание |
|---------|-----|----------|
| `id` | UUID | PK |
| `user_id` | UUID | FK users(id), ON DELETE CASCADE |
| `token_hash` | VARCHAR(255) | UNIQUE — хэш из письма |
| `expires_at` | TIMESTAMPTZ | NOT NULL |
| `used_at` | TIMESTAMPTZ | NULL → заполняется при использовании |
| `created_at` | TIMESTAMPTZ | NOT NULL |

```sql
CREATE TABLE password_reset_tokens (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  VARCHAR(255) NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ  NOT NULL,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);
```

---

## 3. Бренды и подписки

### `plans` — тарифные планы

**Что хранит:** каталог доступных тарифов («Стартап», «Бизнес» и т.д.) с ценой и списком фич.

**Почему отдельная таблица:**
- Тарифы меняются (новые фичи, переименование) — не нужно трогать записи подписок.
- История: видно, на каком именно тарифе (с какими фичами) была подписка.
- Можно деактивировать тариф (`is_active = false`) — он перестаёт предлагаться новым пользователям, но существующие подписки остаются.

**`features TEXT[]`** — массив строк PostgreSQL. Порядок важен (это порядок отображения в UI). Хранить как массив проще, чем в отдельной таблице `plan_features` — количество фич у тарифа фиксировано и не меняется динамически.

**`price` в целых числах** — хранить деньги как INT (копейки) надёжнее, чем NUMERIC/FLOAT — нет проблем с точностью при арифметике.

| Колонка | Тип | Описание |
|---------|-----|----------|
| `id` | UUID | PK |
| `name` | VARCHAR(100) | NOT NULL — «Бизнес», «Стартап» |
| `price` | INTEGER | NOT NULL — в копейках |
| `period` | VARCHAR(10) | NOT NULL — `мес`, `год` |
| `features` | TEXT[] | NOT NULL, default '{}' |
| `is_active` | BOOLEAN | NOT NULL, default true |
| `created_at` | TIMESTAMPTZ | NOT NULL |

```sql
CREATE TABLE plans (
  id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name       VARCHAR(100) NOT NULL,
  price      INTEGER      NOT NULL,
  period     VARCHAR(10)  NOT NULL,
  features   TEXT[]       NOT NULL DEFAULT '{}',
  is_active  BOOLEAN      NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);
```

---

### `brands` — бренды

**Что хранит:** бренд как организационную единицу. Все компании, команда и подписка привязаны к бренду.

**`slug`** — URL-safe идентификатор, генерируется из `name` (транслитерация + нормализация). Нужен для роутинга (`/brands/alfa-grupp`) и SEO. UNIQUE — два бренда не могут иметь одинаковый slug.

**`owner_id`** — пользователь-создатель. Не каскадируется при удалении пользователя — нельзя просто так удалить владельца бренда, нужна явная передача прав.

**`timezone`** — IANA-зона (напр. `Europe/Moscow`). Нужна для правильного отображения расписаний компаний и биллинговых дат.

**`status: deleted`** — мягкое удаление (soft delete). Бренд не удаляется из БД, только меняет статус. Сохраняется история, можно восстановить.

| Колонка | Тип | Описание |
|---------|-----|----------|
| `id` | UUID | PK |
| `name` | VARCHAR(100) | NOT NULL |
| `slug` | VARCHAR(120) | NOT NULL, UNIQUE |
| `owner_id` | UUID | FK users(id) |
| `status` | brand_status | NOT NULL, default 'active' |
| `timezone` | VARCHAR(64) | NOT NULL — IANA |
| `description` | TEXT | NULL |
| `logo_url` | VARCHAR(500) | NULL — CDN-ссылка |
| `created_at` | TIMESTAMPTZ | NOT NULL |
| `updated_at` | TIMESTAMPTZ | NOT NULL |

```sql
CREATE TABLE brands (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(100) NOT NULL,
  slug        VARCHAR(120) NOT NULL UNIQUE,
  owner_id    UUID         NOT NULL REFERENCES users(id),
  status      brand_status NOT NULL DEFAULT 'active',
  timezone    VARCHAR(64)  NOT NULL,
  description TEXT,
  logo_url    VARCHAR(500),
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);
```

---

### `subscriptions` — подписки брендов

**Что хранит:** текущий тарифный план бренда и его статус.

**Почему 1:1 с брендом (`UNIQUE brand_id`):**
- У бренда в любой момент ровно одна активная подписка — это бизнес-требование.
- Упрощает запросы: `SELECT * FROM subscriptions WHERE brand_id = ?` всегда вернёт одну строку.

**`status` (sub_status):**
- `trial` — пробный период, `trial_ends_at` заполнен
- `active` — оплачен, работает
- `expiring` — истекает в ближайшее время (предупреждение в UI)
- `past_due` — просрочен платёж, но ещё работает (grace period)
- `expired` — доступ ограничен
- `none` — нет подписки (новый бренд)

| Колонка | Тип | Описание |
|---------|-----|----------|
| `id` | UUID | PK |
| `brand_id` | UUID | FK brands(id), UNIQUE |
| `plan_id` | UUID | FK plans(id) |
| `status` | sub_status | NOT NULL |
| `trial_ends_at` | TIMESTAMPTZ | NULL |
| `renews_at` | TIMESTAMPTZ | NULL |
| `created_at` | TIMESTAMPTZ | NOT NULL |
| `updated_at` | TIMESTAMPTZ | NOT NULL |

```sql
CREATE TABLE subscriptions (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id      UUID        NOT NULL UNIQUE REFERENCES brands(id) ON DELETE CASCADE,
  plan_id       UUID        NOT NULL REFERENCES plans(id),
  status        sub_status  NOT NULL,
  trial_ends_at TIMESTAMPTZ,
  renews_at     TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

### `addons` — каталог дополнений

**Что хранит:** справочник доступных аддонов («Дополнительные бренды», «Расширенная аналитика»).

**Зачем отдельно от `subscription_addons`:** аддон — это шаблон (название, тип). `subscription_addons` — это экземпляр аддона на конкретной подписке с её лимитами и сроком.

| Колонка | Тип | Описание |
|---------|-----|----------|
| `id` | UUID | PK |
| `name` | VARCHAR(100) | NOT NULL |
| `is_active` | BOOLEAN | NOT NULL, default true |
| `created_at` | TIMESTAMPTZ | NOT NULL |

```sql
CREATE TABLE addons (
  id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name       VARCHAR(100) NOT NULL,
  is_active  BOOLEAN      NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);
```

---

### `subscription_addons` — активные аддоны подписки

**Что хранит:** какие аддоны подключены к конкретной подписке и их текущее состояние.

**`limit_used / limit_total / limit_unit`** — у некоторых аддонов есть счётчик (напр., «Дополнительные бренды: 3 из 5»). `NULL` в `limit_total` означает безлимитный аддон. `limit_unit` — человекочитаемая единица для UI («брендов», «отзывов / мес»).

**`expires_at`** — аддон может иметь свой срок истечения, независимый от основной подписки (напр., купили аддон на 3 месяца, а план — на год).

| Колонка | Тип | Описание |
|---------|-----|----------|
| `id` | UUID | PK |
| `subscription_id` | UUID | FK subscriptions(id), ON DELETE CASCADE |
| `addon_id` | UUID | FK addons(id) |
| `status` | addon_status | NOT NULL |
| `expires_at` | TIMESTAMPTZ | NULL |
| `limit_used` | INTEGER | NULL — текущее использование |
| `limit_total` | INTEGER | NULL — максимум (NULL = безлимит) |
| `limit_unit` | VARCHAR(50) | NULL — «брендов», «отзывов» |

```sql
CREATE TABLE subscription_addons (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID         NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  addon_id        UUID         NOT NULL REFERENCES addons(id),
  status          addon_status NOT NULL,
  expires_at      TIMESTAMPTZ,
  limit_used      INTEGER,
  limit_total     INTEGER,
  limit_unit      VARCHAR(50)
);
```

---

## 4. Команда — участники и приглашения

### `user_brands` — участники команды

**Что хранит:** кто и в каком качестве состоит в команде бренда.

**Почему не хранить роль в `users`:**
- Пользователь может быть участником нескольких брендов одновременно с разными ролями.
- Например: `owner` в «Альфа групп» и `manager` в «Крас-пас» — это нормальная ситуация.

**`status`:**
- `active` — активный участник
- `suspended` — заблокирован администратором (не может войти в бренд, но запись сохранена)
- `left` — покинул команду самостоятельно
- `pending` — принял приглашение, но ещё не завершил онбординг (редкий кейс)

**`UNIQUE (user_id, brand_id)`** — один пользователь не может быть участником одного бренда дважды.

**`last_login_at`** — обновляется при каждом входе в контекст бренда. Используется в списке участников команды.

| Колонка | Тип | Описание |
|---------|-----|----------|
| `id` | UUID | PK |
| `user_id` | UUID | FK users(id), ON DELETE CASCADE |
| `brand_id` | UUID | FK brands(id), ON DELETE CASCADE |
| `role` | user_role | NOT NULL |
| `status` | user_status | NOT NULL, default 'active' |
| `joined_at` | TIMESTAMPTZ | NOT NULL, default now() |
| `last_login_at` | TIMESTAMPTZ | NULL |

```sql
CREATE TABLE user_brands (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  brand_id      UUID        NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  role          user_role   NOT NULL,
  status        user_status NOT NULL DEFAULT 'active',
  joined_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at TIMESTAMPTZ,
  UNIQUE (user_id, brand_id)
);
```

---

### `invitations` — приглашения в команду

**Что хранит:** приглашения, отправленные от имени бренда. Два режима: персональное (с email) и ссылочное (без email).

**`email NULL`** — ссылочное приглашение: генерируется ссылка, которую можно отправить кому угодно. Любой, кто перейдёт по ней и зарегистрируется/войдёт, станет участником. Сейчас в API не реализовано, но структура поддерживает.

**`status`:**
- `active` — действует
- `revoked` — отозвано вручную (`DELETE /brands/:brandId/invitations/:id`)
- `exhausted` — использовано (для персонального приглашения — однократно, для ссылочного — может быть многоразовым)

**`CHECK (role <> 'owner')`** — нельзя пригласить кого-то сразу как владельца. Owner может быть только один и только через передачу прав.

**`accepted_by_id / accepted_at`** — кто и когда принял приглашение. Нужно для аудита и чтобы понять, создавать ли нового пользователя или добавить существующего в команду.

| Колонка | Тип | Описание |
|---------|-----|----------|
| `id` | UUID | PK |
| `brand_id` | UUID | FK brands(id), ON DELETE CASCADE |
| `email` | VARCHAR(254) | NULL — персональное; NULL = ссылочное |
| `role` | user_role | NOT NULL, CHECK ≠ owner |
| `created_by_id` | UUID | FK users(id) |
| `status` | invite_status | NOT NULL, default 'active' |
| `expires_at` | TIMESTAMPTZ | NOT NULL |
| `accepted_by_id` | UUID | FK users(id), NULL |
| `accepted_at` | TIMESTAMPTZ | NULL |
| `created_at` | TIMESTAMPTZ | NOT NULL |

```sql
CREATE TABLE invitations (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id       UUID          NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  email          VARCHAR(254),
  role           user_role     NOT NULL CHECK (role <> 'owner'),
  created_by_id  UUID          NOT NULL REFERENCES users(id),
  status         invite_status NOT NULL DEFAULT 'active',
  expires_at     TIMESTAMPTZ   NOT NULL,
  accepted_by_id UUID          REFERENCES users(id),
  accepted_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT now()
);
```

---

## 5. Рефералы

### `referrals`

**Что хранит:** факт того, что пользователь X зарегистрировался по реферальной ссылке пользователя Y.

**`UNIQUE (referred_id)`** — один пользователь может быть рефералом только одного человека. Нельзя «пригласить» уже зарегистрированного пользователя.

**`status`:**
- `pending` — зарегистрировался, но ещё не оплатил подписку
- `confirmed` — оплатил первый период — бонус подтверждён
- `bonus_paid` — бонус начислен реферреру
- `cancelled` — отменён (рефeral удалил аккаунт, возврат платежа и т.д.)

**`plan_name` и `reward`** — денормализованные поля для отображения в UI без JOIN к `subscriptions` и `plans`. `reward NULL` = бонус ещё не начислен.

| Колонка | Тип | Описание |
|---------|-----|----------|
| `id` | UUID | PK |
| `referrer_id` | UUID | FK users(id) — кто пригласил |
| `referred_id` | UUID | FK users(id), UNIQUE |
| `status` | referral_status | NOT NULL, default 'pending' |
| `plan_name` | VARCHAR(100) | NULL — тариф реферала |
| `reward` | INTEGER | NULL — бонус в копейках |
| `registered_at` | TIMESTAMPTZ | NOT NULL |

```sql
CREATE TABLE referrals (
  id            UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id   UUID            NOT NULL REFERENCES users(id),
  referred_id   UUID            NOT NULL UNIQUE REFERENCES users(id),
  status        referral_status NOT NULL DEFAULT 'pending',
  plan_name     VARCHAR(100),
  reward        INTEGER,
  registered_at TIMESTAMPTZ     NOT NULL DEFAULT now()
);
```

---

## 6. Компании — базовые данные

### `company_groups` — группы компаний

**Что хранит:** логические группы для организации компаний внутри бренда (напр., «Москва», «Флагманы», «Север»).

**Почему не просто поле `group` в `companies`:**
- Компания может входить в несколько групп одновременно (N:M).
- Группы переименовываются — изменение в одном месте, не нужно обновлять все компании.
- Можно фильтровать/считать компании по группе без строкового поиска.

**Зависимость от `brand_id`:** группы существуют в контексте бренда. При удалении бренда — группы удаляются каскадно.

| Колонка | Тип | Описание |
|---------|-----|----------|
| `id` | UUID | PK |
| `brand_id` | UUID | FK brands(id), ON DELETE CASCADE |
| `name` | VARCHAR(100) | NOT NULL |
| `created_at` | TIMESTAMPTZ | NOT NULL |

```sql
CREATE TABLE company_groups (
  id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id   UUID         NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  name       VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);
```

---

### `companies` — компании (базовые данные)

**Что хранит:** «скелет» компании — данные, нужные для листинга, поиска, роутинга и агрегации. Полные данные карточки — в `company_cards`.

**Почему `companies` и `company_cards` разделены:**
- `GET /companies` (список) должен работать быстро и без тяжёлых JOIN к JSONB-полям карточки.
- `company_cards` хранит большой объём данных (расписание, все переводы, телефоны) — нет смысла тянуть это для каждой строки списка.
- Разные права доступа: список компаний могут видеть все участники, форму карточки — только редакторы.

**Денормализованные поля:**
- `name` — дублируется из `card.names.default[0].val`. Обновляется при сохранении карточки. Нужен для поиска (`GIN`-индекс) и отображения в списке.
- `address_display` — строка вида «Москва, ул. Тверская, 15», собранная из `card.address.default`. Нужна для отображения в строке таблицы без парсинга JSONB.

**`status` (company_status):**
- `draft` — только создана, карточка не заполнена / не опубликована
- `active` — работает, опубликована на платформах
- `temporarily_closed` — временно закрыта (публикуется на платформах с соответствующим статусом)
- `suspended` — приостановлена администратором
- `deleted` — мягкое удаление (soft delete)

**`code`** — внутренний идентификатор компании, который задаёт сам пользователь (напр., MSK-001). Полезен для интеграций и импорта.

| Колонка | Тип | Описание |
|---------|-----|----------|
| `id` | UUID | PK |
| `brand_id` | UUID | FK brands(id), ON DELETE CASCADE |
| `name` | VARCHAR(255) | NOT NULL — денорм. из карточки |
| `slug` | VARCHAR(300) | NOT NULL, UNIQUE |
| `status` | company_status | NOT NULL, default 'draft' |
| `code` | VARCHAR(50) | NULL — внутренний код |
| `address_display` | TEXT | NULL — денорм. строка адреса |
| `rating` | NUMERIC(3,1) | NULL — агрегируется из отзывов |
| `review_count` | INTEGER | NOT NULL, default 0 |
| `created_at` | TIMESTAMPTZ | NOT NULL |
| `updated_at` | TIMESTAMPTZ | NOT NULL |

```sql
CREATE TABLE companies (
  id              UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id        UUID           NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  name            VARCHAR(255)   NOT NULL,
  slug            VARCHAR(300)   NOT NULL UNIQUE,
  status          company_status NOT NULL DEFAULT 'draft',
  code            VARCHAR(50),
  address_display TEXT,
  rating          NUMERIC(3,1),
  review_count    INTEGER        NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ    NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ    NOT NULL DEFAULT now()
);
```

---

### `company_group_members` — связь компаний с группами

**Что хранит:** принадлежность компании к группе. Чистая таблица связей N:M.

**Почему каскад при удалении группы (`ON DELETE CASCADE`):**
- При удалении группы через `DELETE /company-groups/:id` сами компании не трогаются — только строки в `company_group_members` удаляются. Компании «теряют» принадлежность к группе, но продолжают существовать.
- При удалении компании — все её членства в группах удаляются автоматически.

| Колонка | Тип | Описание |
|---------|-----|----------|
| `company_id` | UUID | FK companies(id), ON DELETE CASCADE |
| `group_id` | UUID | FK company_groups(id), ON DELETE CASCADE |
| PK | — | `(company_id, group_id)` |

```sql
CREATE TABLE company_group_members (
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  group_id   UUID NOT NULL REFERENCES company_groups(id) ON DELETE CASCADE,
  PRIMARY KEY (company_id, group_id)
);
```

---

## 7. Карточки компаний (CompanyFormData)

### `company_cards` — данные формы карточки

**Что хранит:** все редактируемые поля компании, которые публикуются на геоплатформах: названия, телефоны, адрес, расписание, категории, описания, сайты, соцсети.

**Ключевое архитектурное решение: почему JSONB?**

Каждое поле карточки реализует паттерн `PlatformField<T>`:
```json
{
  "default": <значение>,
  "platforms": {
    "yandex": <переопределение>,
    "twogis": <переопределение>
  },
  "isException": true
}
```

Альтернативы и почему они хуже:

| Вариант | Проблема |
|---------|----------|
| 13 отдельных нормализованных таблиц (`company_names`, `company_phones`, …) | Сложность: для чтения карточки нужен JOIN к 13 таблицам. Для обновления одного поля — UPDATE в нескольких таблицах. |
| Одна универсальная `company_fields(field_name, platform, data)` | EAV-антипаттерн: нет типизации, нет constraints, сложные запросы |
| Одна большая JSONB-колонка `card_data` | Нельзя частично обновить поле через `PATCH` без чтения всего документа; конфликты при параллельных изменениях |
| **JSONB-колонка на каждое поле** ✅ | Каждое поле обновляется независимо. Структура 1:1 с API. Добавление платформы — не требует миграции. |

**Связь 1:1 с `companies`** — `company_id` одновременно PK и FK. Одна компания — одна карточка, всегда.

**Поля `names`, `descriptions` и т.д. создаются при создании компании пустыми** (`NULL`) и заполняются при первом редактировании карточки.

| Колонка | Тип | Описание |
|---------|-----|----------|
| `company_id` | UUID | PK, FK companies(id) |
| `names` | JSONB | `PlatformField<LocalizedValue[]>` |
| `short_names` | JSONB | `PlatformField<LocalizedValue[]>` |
| `alt_names` | JSONB | `PlatformField<{ val: string }[]>` |
| `email` | JSONB | `PlatformField<string>` |
| `phones` | JSONB | `PlatformField<Phone[]>` |
| `address` | JSONB | `PlatformField<Address>` |
| `websites` | JSONB | `PlatformField<Website[]>` |
| `socials` | JSONB | `PlatformField<Social[]>` |
| `main_category` | JSONB | `PlatformField<Category>` |
| `additional_categories` | JSONB | `PlatformField<Category[]>` |
| `descriptions` | JSONB | `PlatformField<LocalizedValue[]>` |
| `short_descriptions` | JSONB | `PlatformField<LocalizedValue[]>` |
| `schedule` | JSONB | `WeekSchedule` |
| `special_days` | JSONB | `SpecialDay[]` |
| `updated_at` | TIMESTAMPTZ | NOT NULL, default now() |

```sql
CREATE TABLE company_cards (
  company_id            UUID        PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
  names                 JSONB,
  short_names           JSONB,
  alt_names             JSONB,
  email                 JSONB,
  phones                JSONB,
  address               JSONB,
  websites              JSONB,
  socials               JSONB,
  main_category         JSONB,
  additional_categories JSONB,
  descriptions          JSONB,
  short_descriptions    JSONB,
  schedule              JSONB,
  special_days          JSONB,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

### JSONB-структуры полей карточки

#### `PlatformField<T>` — общий шаблон
```json
{
  "default": "<T>",
  "platforms": {
    "yandex": "<T>",
    "twogis": "<T>"
  },
  "isException": true
}
```
**Логика публикации на платформу:**
1. `isException: false` (или поле отсутствует) → берём значение из шаблона бренда.
2. `isException: true` → берём `platforms.<platform>` если задано, иначе `default`.

`platforms` и `isException` — опциональны. Минимальная форма: `{ "default": "..." }`.

---

#### `LocalizedValue` — для `names`, `descriptions`, `short_names`, `short_descriptions`
```json
[
  { "lang": "ru", "val": "Кофейня Арома" },
  { "lang": "en", "val": "Aroma Coffee" }
]
```
Массив потому что одно поле может иметь значения на нескольких языках одновременно.

---

#### `Phone`
```json
{
  "phone": "+7 (495) 123-45-67",
  "description": "Основной",
  "ext": "101",
  "hidden": false
}
```
`ext`, `description`, `hidden` — опциональны. `hidden: true` — номер скрыт от публичного отображения на платформах.

---

#### `Address`
```json
{
  "country":    "Россия",
  "region":     "Москва",
  "city":       "Москва",
  "postalCode": "119021",
  "street":     "ул. Льва Толстого",
  "building":   "16",
  "comment":    "2 этаж, вход со двора",
  "lat":        "55.733974",
  "lon":        "37.587093"
}
```
`lat`/`lon` — координаты как строки (избегаем потери точности float). Используются для карты и геокодирования на платформах.

---

#### `Website` / `Social`
```json
{ "type": "website", "url": "https://aroma-coffee.ru" }
```
Допустимые `type`: `website` | `instagram` | `vk` | `facebook` | `twitter` | `youtube` | `telegram` | `tiktok` | `ok` | `linkedin` | `pinterest`

Технически `websites` и `socials` — одна и та же структура. Разделены в API для удобства редактирования в UI (разные секции формы).

---

#### `Category`
```json
{ "id": "coffee", "name": "Кофейня" }
```
`id` — идентификатор категории в системе (используется при публикации на платформу). `name` — человекочитаемый лейбл для UI.

---

#### `WeekSchedule`
```json
{
  "mon": { "closed": false, "from": "08:00", "to": "22:00" },
  "tue": { "closed": false, "from": "08:00", "to": "22:00" },
  "wed": { "closed": false, "from": "08:00", "to": "22:00" },
  "thu": { "closed": false, "from": "08:00", "to": "22:00" },
  "fri": { "closed": false, "from": "08:00", "to": "23:00" },
  "sat": { "closed": false, "from": "09:00", "to": "23:00" },
  "sun": { "closed": true,  "from": "10:00", "to": "21:00" }
}
```
`schedule` — единственное поле без обёртки `PlatformField`: расписание одно для всех платформ (платформы сами преобразуют формат при публикации). При `closed: true` поля `from`/`to` сохраняются в БД, но игнорируются при публикации.

---

#### `SpecialDay`
```json
{ "date": "01.01.2026", "closed": true, "from": "09:00", "to": "18:00" }
```
Исключения из обычного расписания: праздники, акционные дни. Массив, не обёрнут в `PlatformField`.

---

## 8. Платформы

### `company_platforms` — подключения к геоплатформам

**Что хранит:** статус интеграции компании с каждой платформой (Яндекс Бизнес, 2ГИС).

**Почему отдельная таблица, а не поля в `companies`:**
- Платформ может стать больше (Google Maps, Zoon и т.д.) — добавление новой платформы не требует ALTER TABLE на `companies`.
- У каждой платформы — свой набор полей (`org_id`, `sync_error`), которые не нужны при отсутствии подключения.
- Один `UNIQUE (company_id, platform)` — нельзя подключить одну платформу дважды.

**Строки создаются автоматически** при создании компании — по одной на каждую поддерживаемую платформу со статусом `not_connected`. Это гарантирует, что `GET /companies/:id/platforms` всегда вернёт полный список.

**`status` (platform_status):**
- `not_connected` — никогда не подключалась; требует первичной настройки
- `connected` — подключена, синхронизируется
- `pending` — заявка подана, ждём активации от платформы
- `action_required` — платформа требует ручного подтверждения со стороны пользователя
- `disconnected` — отключена вручную (была подключена ранее)
- `error` — ошибка синхронизации; подробности в `sync_error`

**`org_id`** — внешний идентификатор организации на платформе (напр., `YA-00341` в Яндексе). Используется при публикации данных карточки.

**`is_enabled`** — флаг «включена ли публикация на эту платформу». Можно отключить платформу без потери настроек подключения.

| Колонка | Тип | Описание |
|---------|-----|----------|
| `id` | UUID | PK |
| `company_id` | UUID | FK companies(id), ON DELETE CASCADE |
| `platform` | platform_type | NOT NULL |
| `status` | platform_status | NOT NULL, default 'not_connected' |
| `is_enabled` | BOOLEAN | NOT NULL, default false |
| `org_id` | VARCHAR(100) | NULL — ID на платформе |
| `org_name` | VARCHAR(255) | NULL — название на платформе |
| `connected_at` | TIMESTAMPTZ | NULL |
| `last_sync_at` | TIMESTAMPTZ | NULL |
| `sync_error` | TEXT | NULL |

```sql
CREATE TABLE company_platforms (
  id           UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   UUID            NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  platform     platform_type   NOT NULL,
  status       platform_status NOT NULL DEFAULT 'not_connected',
  is_enabled   BOOLEAN         NOT NULL DEFAULT false,
  org_id       VARCHAR(100),
  org_name     VARCHAR(255),
  connected_at TIMESTAMPTZ,
  last_sync_at TIMESTAMPTZ,
  sync_error   TEXT,
  UNIQUE (company_id, platform)
);
```

---

## 9. Индексы

```sql
-- Поиск сессии по токену (каждый запрос к API)
CREATE INDEX idx_sessions_token      ON sessions(token_hash);
CREATE INDEX idx_sessions_expires    ON sessions(expires_at);

-- Поиск пользователя при логине
CREATE INDEX idx_users_email         ON users(email);

-- Бренды пользователя
CREATE INDEX idx_brands_owner        ON brands(owner_id);
CREATE INDEX idx_user_brands_user    ON user_brands(user_id);
CREATE INDEX idx_user_brands_brand   ON user_brands(brand_id);

-- Подписка бренда (1:1, но индекс для скорости)
CREATE INDEX idx_subscriptions_brand ON subscriptions(brand_id);

-- Приглашения бренда
CREATE INDEX idx_invitations_brand   ON invitations(brand_id);
CREATE INDEX idx_invitations_email   ON invitations(email);

-- Группы бренда
CREATE INDEX idx_groups_brand        ON company_groups(brand_id);

-- Компании бренда + полнотекстовый поиск по названию
CREATE INDEX idx_companies_brand     ON companies(brand_id);
CREATE INDEX idx_companies_status    ON companies(status);
CREATE INDEX idx_companies_name_fts  ON companies USING gin(to_tsvector('russian', name));

-- Платформы компании
CREATE INDEX idx_platforms_company   ON company_platforms(company_id);

-- GIN-индекс для поиска по адресу в карточках (если нужно)
CREATE INDEX idx_cards_address       ON company_cards USING gin(address);
```

---

## 10. ER-диаграмма

```
users
 ├── sessions
 ├── password_reset_tokens
 ├── referrals (referrer_id / referred_id — самоссылки на users)
 │
 ├── user_brands ──────────────────────────── brands
 │                                              │
 │                                              ├── subscriptions ── subscription_addons ── addons
 │                                              ├── invitations
 │                                              ├── company_groups
 │                                              │         │
 │                                              └── companies ──── company_group_members
 │                                                      │
 │                                                      ├── company_cards
 │                                                      └── company_platforms
 │
 └── (created_by_id в invitations)
```

### Краткая сводка по таблицам

| Таблица | Строк на бренд | Назначение |
|---------|---------------|------------|
| `users` | N (участники) | Учётные записи |
| `sessions` | N на user | Активные сессии |
| `password_reset_tokens` | редко | Сброс пароля |
| `brands` | 1 | Организационная единица |
| `plans` | справочник | Каталог тарифов |
| `subscriptions` | 1 | Текущий тариф бренда |
| `addons` | справочник | Каталог дополнений |
| `subscription_addons` | N | Активные аддоны подписки |
| `user_brands` | N | Команда бренда |
| `invitations` | N | Приглашения в команду |
| `referrals` | N | Реферальная программа |
| `company_groups` | N | Группы для организации компаний |
| `companies` | N | Компании (для листинга) |
| `company_group_members` | N×M | Связь компаний с группами |
| `company_cards` | 1 на компанию | Полные данные карточки (форма) |
| `company_platforms` | 2 на компанию | Статус подключения к платформам |

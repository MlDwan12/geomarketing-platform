# Журнал рефакторинга — geomarketing-platform

> Заполняется по мере выполнения. Секреты/токены/пароли/содержимое `.env` не записываются.
> Ветка: `refactor/foundation-and-safety`.

## Базовая точка (до изменений)
- Дата: 2026-07-27
- Ветка: `master` → создана `refactor/foundation-and-safety`
- Незакоммиченные изменения на входе (сохранены, НЕ трогались):
  - `apps/core-service/src/company/company.service.ts` (WIP-правка `key in templateFields`)
  - `docs/insomnia-collection.json`
  - `docs/status.md` (untracked)
- Тесты (baseline): 1 passed, 1 total (`libs/common/src/common.service.spec.ts`)
- Сборка/типы (baseline): `tsc --noEmit` — EXIT 0

---

## Этап 0 — тест-инфраструктура + characterization-тесты
Статус: **завершён**

### Цель
Зафиксировать текущее наблюдаемое поведение критической чистой логики перед
любым рефакторингом, чтобы будущие этапы (ARCH-001/003/005, DB-002) не изменили
результат незаметно. Инфраструктура jest уже работает глобально (ts-jest +
`moduleNameMapper`), отдельная настройка не потребовалась.

### Затрагиваемые файлы (только добавление)
- `REFACTORING_INSTRUCTIONS.md` (новый)
- `REFACTORING_LOG.md` (новый)
- `apps/core-service/src/company/company-card.characterization.spec.ts` (новый)
- `apps/api-gateway/src/filters/error-mapping.characterization.spec.ts` (новый)
- `apps/api-gateway/src/interceptors/response.interceptor.characterization.spec.ts` (новый)

### Что НЕ менялось
- Ни один файл продакшн-кода не изменён (0 правок в `apps/**` вне новых `.spec.ts`).
- WIP-правка в `company.service.ts` сохранена как есть.
- Публичные контракты не затронуты.

### Покрытое поведение
- `CompanyService.resolveForPlatform` — приоритет override→company→template,
  platform-override, merge мультиязычных полей, `isException:false`.
- `CompanyService.assembleCardFields` — формы `{default,platforms}` /
  `{isException,default,platforms}`, **включая WIP-правку** (ключ вне шаблона).
- `CompanyService.slugify` — транслитерация RU→EN и нормализация.
- `HttpExceptionFilter` / `RpcExceptionFilter` — маппинг статус→код, формат
  `{success:false,error:{code,message,details?}}`, `headersSent`.
- `ResponseInterceptor` — обёртка `{success:true,data}`, формат дат по `X-Timezone`.

### Проверки
- Тесты: **23/23** passed (было 1/1; +22 характеризационных).
- TypeScript (`tsc --noEmit`): **EXIT 0**.
- ESLint (новые файлы, без `--fix`): **EXIT 0**.
- API-контракт: изменений нет (код не трогался).

### Заметки
- Тесты чистых методов создают `CompanyService` с dummy-зависимостями
  (методы не обращаются к репозиториям).
- Новые spec-файлы отформатированы проектным `prettier` (только эти 3 файла).

### Риски
Новых рисков не обнаружено. Тесты документируют РЕАЛЬНОЕ поведение (в т.ч.
возможные неоптимальности) — их нельзя менять без согласованного изменения поведения.

### Откат
Удалить 5 добавленных файлов (2 doc + 3 spec). Продакшн-код отката не требует.

---

## Этап 1 — быстрые безопасные фиксы (DRY)
Статус: **завершён**

### Цель
Устранить дублирование в слое api-gateway без изменения поведения и публичных
контрактов: (1a) единый маппинг статус→код ошибки, (1b) единый RPC-хелпер.

Примечание к плану: чистка debug-`console.log` **перенесена в Этап 2**
(там правки тех же файлов по безопасности — чтобы не редактировать их дважды).

### Затрагиваемые файлы
Добавлено:
- `apps/api-gateway/src/common/error-codes.ts` — `STATUS_TO_CODE` + `codeFromStatus`
- `apps/api-gateway/src/common/rpc.ts` — `sendRpc(client, pattern, payload, timeoutMs?)`

Изменено (только структура вызовов, поведение сохранено):
- `filters/http-exception.filter.ts`, `filters/rpc-exception.filter.ts` — используют общий `codeFromStatus`
- `api-gateway.controller.ts`, `auth/auth.controller.ts`, `brands/brands.controller.ts`,
  `companies/companies.controller.ts`, `groups/groups.controller.ts`,
  `templates/templates.controller.ts`, `import/two-gis-import.controller.ts` — переведены на `sendRpc`

### Что сохранено (BC)
- URL, HTTP-методы, `@HttpCode`, формы request/response, RMQ-паттерны — без изменений.
- Формат тела ошибки `{success:false,error:{code,message,details?}}` — без изменений.
- Таймауты сохранены per-endpoint: контроллеры 5000мс, `import/2gis` 10000мс, `health/core` 3000мс.
- Тип результата RPC остался `any` — типизация вызовов не изменилась.

### Проверки
- TypeScript (`tsc --noEmit`): EXIT 0.
- Тесты: 23/23 passed (в т.ч. characterization фильтров и карточки).
- Сборка (`nest build api-gateway`): success.
- ESLint (api-gateway): 143 → 107 замечаний (−36; регресса нет, дублирование сокращено).
- API-контракт: изменений нет.

### Риски
Низкие. RPC-хелпер и маппинг кодов семантически идентичны прежнему коду; per-endpoint
таймауты и payload'ы сверены построчно. Прямых тестов контроллеров нет — защита
обеспечена сборкой, типами и характеризационными тестами фильтров.

### Откат
`git revert` коммита этапа, либо удалить 2 новых файла (`common/error-codes.ts`,
`common/rpc.ts`) и вернуть inline-обёртки в перечисленных файлах.

---

## Этап 2 — безопасность
Статус: **в работе (2a завершён; 2b ожидает коммит Этапа 1)**

Разбит на две части из-за атомарности коммитов: 2b правит файлы, входящие в
коммит Этапа 1 (`auth.controller.ts`, `brands.controller.ts`), поэтому выполняется
после того, как владелец закоммитит Этап 1.

### 2a — CORS-allowlist, prod-guard SESSION_SECRET, чистка debug-логов
Статус: завершён

Решения владельца:
- SEC-001: `CORS_ORIGINS` (env), fallback — прежнее поведение (dev не ломается).
- SEC-002: `@nestjs/throttler` на auth-эндпоинтах — выполняется в 2b.

Изменённые файлы:
- `apps/api-gateway/src/main.ts` — CORS-allowlist по `CORS_ORIGINS` (SEC-001);
  prod-guard `SESSION_SECRET` + убран хардкод-fallback как значение по умолчанию
  (в dev fallback сохранён) (SEC-003); удалён debug-middleware с логом content-type (SEC-004).
- `apps/api-gateway/src/auth/guards/session.guard.ts` — удалён debug-лог
  sessionID/cookie/userId (SEC-004).
- `libs/config/src/env.validation.ts` — добавлен опциональный `CORS_ORIGINS`.
- `.env.example` — документированы `CORS_ORIGINS` и обязательность `SESSION_SECRET` в prod.

Что сохранено (BC):
- CORS без `CORS_ORIGINS` ведёт себя как раньше (отражает любой origin) — dev не ломается.
- Формат ответов, HTTP-контракты, RMQ-паттерны — без изменений.
- В dev `SESSION_SECRET` по-прежнему опционален (fallback), guard срабатывает только в prod.

Проверки:
- TypeScript: EXIT 0. Тесты: 23/23. Сборка `nest build api-gateway`: success.
- ESLint (api-gateway): 107 → 98 (−9; регресса нет).
- API-контракт: изменений нет.

Риски: низкие. Изменения CORS обратимо-совместимы (fallback), guard секрета активен только в prod.

### 2b — чистка логов auth/brands + rate-limit
Статус: завершён

Изменённые файлы:
- `apps/api-gateway/src/auth/auth.controller.ts` (SEC-004, SEC-002):
  - убраны `console.log` в login (sessionID/headers), упрощён колбэк `session.save`;
  - dev-лог токена сброса оставлен только для non-production (`NODE_ENV !== 'production'`) —
    в prod секрет не логируется, dev-тестирование сброса сохранено (mail-service ещё нет);
  - `@UseGuards(ThrottlerGuard)` + `@Throttle({default:{limit:10,ttl:60000}})` на
    login/register/forgot-password/reset-password.
- `apps/api-gateway/src/auth/auth.module.ts` (SEC-002): `ThrottlerModule.forRoot([{ttl:60000,limit:10}])`.
- `apps/api-gateway/src/brands/brands.controller.ts` (SEC-004): удалён неиспользуемый
  `DebugBodyInterceptor` (мёртвый код, только console.log) и его импорты; убраны MULTER/CREATE debug-логи.
- `package.json`, `yarn.lock`: добавлена зависимость `@nestjs/throttler@6.5.0`.

Что сохранено (BC):
- HTTP-маршруты, коды, формы request/response — без изменений. Rate-limit добавляет
  только ответ 429 при превышении на 4 публичных auth-роутах; штатные сценарии не затронуты.
- Логи не являются публичным контрактом; удаление debug-вывода поведение API не меняет.

Проверки:
- TypeScript: EXIT 0. Тесты: 23/23. Сборка `nest build api-gateway`: success.
- ESLint (api-gateway): 98 → 90 (−8).
- Остаточные `console`: только легитимные (GLOBAL ERROR, Redis error, listening, dev-token под guard).

Риски: низкие. Rate-limit не трогает существующие успешные сценарии; лимит 10/мин на IP.
Runtime DI throttler проверен сборкой; функциональную проверку 429 стоит сделать при smoke-тесте стека.

### Итог Этапа 2
Статус: **завершён** (2a + 2b). Готово к коммиту одним коммитом Этапа 2.

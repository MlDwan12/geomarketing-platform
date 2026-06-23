# Бренды и компании

## Иерархия

```
Пользователь
    └── user_brands (роль: owner / admin / manager / viewer)
            └── Бренд
                    ├── company_templates (шаблоны карточек)
                    └── Компания
                            ├── company_defaults (карточка с переопределениями)
                            └── company_platforms (подключения к платформам)
```

---

## Бренды

### Сущность

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | uuid | PK |
| `name` | varchar(100) | Название |
| `slug` | varchar(120) | Уникальный URL-идентификатор, генерируется из name |
| `ownerId` | uuid | Создатель |
| `status` | enum | `active` / `suspended` / `deleted` |
| `timezone` | varchar(64) | Часовой пояс (например `Europe/Moscow`) |
| `description` | text | Описание |
| `logoUrl` | varchar(500) | Ссылка на логотип |

### Доступ — таблица `user_brands`

При создании бренда автоматически создаётся запись `user_brands` с ролью `owner`.

| Действие | Кто может |
|----------|-----------|
| Просмотр списка / карточки | Любой участник бренда |
| Обновление | Только `owner` |
| Удаление | Только `owner` |

### Поведение

- **Slug** — транслитерируется из name (кириллица → латиница), уникален глобально. При коллизии добавляется суффикс `-1`, `-2`, ..., при 10+ — `-<timestamp36>`.
- **Soft delete** — `status = deleted`. Из списков не возвращается, на прямой GET отдаёт 404.
- **Логотип** — принимается через `multipart/form-data` (поле `logo`) или как `logoUrl` строкой.

### API

```
GET    /brands           — список брендов текущего пользователя
GET    /brands/short     — короткий список (id, name, slug, logoUrl) для свитчера
GET    /brands/:id       — один бренд
POST   /brands           — создать
PATCH  /brands/:id       — обновить (только owner)
DELETE /brands/:id       — soft delete (только owner), 204
```

---

## Компании

Физический филиал / точка продаж внутри бренда.

### Сущность `companies`

Хранит только денормализованные поля для списков и служебные данные:

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | uuid | PK |
| `brandId` | uuid | Принадлежность бренду |
| `name` | varchar(255) | Название (денормализовано из карточки) |
| `slug` | varchar(300) | Уникальный идентификатор |
| `status` | enum | `draft` / `active` / `temporarily_closed` / `suspended` / `deleted` |
| `code` | varchar(50) | Внутренний код филиала |
| `addressDisplay` | text | Адрес строкой (денормализован из карточки) |
| `rating` | numeric(3,1) | Рейтинг (из платформ) |
| `reviewCount` | int | Количество отзывов |

### Доступ

Любой участник бренда может просматривать и создавать компании. Soft delete — тоже любой участник.

### При создании автоматически создаётся

1. Запись `company_defaults` — пустая карточка (с привязкой к шаблону если передан `templateId`)
2. Записи `company_platforms` для `yandex` и `twogis` со статусом `not_connected`

### API

```
GET    /companies               — список с пагинацией ?page=1&limit=20, возвращает { items, total, page, limit }
POST   /companies               — создать
GET    /companies/:id           — полный профиль (компания + карточка + платформы)
DELETE /companies/:id           — soft delete, 204
PATCH  /companies/:id/default   — обновить карточку
PATCH  /companies/:id/platforms/:platformKey — обновить подключение платформы
```

Все запросы требуют заголовка `X-Brand-Id`.

---

## Карточка компании

Данные карточки живут в трёх слоях. При чтении они собираются в единую структуру.

### Слой 1 — Шаблон (`company_templates`)

Принадлежит бренду. Один шаблон → много компаний.

Хранит **плоский** объект с дефолтными значениями полей:

```json
{
  "names":      [{ "lang": "ru", "val": "Кофейня Арома" }],
  "phones":     [{ "value": "+79001234567" }],
  "websites":   ["https://example.com"],
  "schedule":   { "Mon": { "working_hours": [{ "from": "09:00", "to": "18:00" }] } },
  "mainCategory": { "id": "666", "name": "Кофейня" },
  "descriptions": [{ "lang": "ru", "val": "Сеть уютных кофеен" }]
}
```

Изменение шаблона мгновенно отражается у всех компаний которые его используют (без `isException`).

```
GET    /templates           — список шаблонов бренда (X-Brand-Id)
POST   /templates           — создать
PATCH  /templates/:id       — обновить
DELETE /templates/:id       — удалить (компании отвязываются, данные не теряются)
```

### Слой 2 — Переопределения компании (`company_defaults`)

Каждая компания имеет ровно одну запись (1:1). Хранит:
- `templateId` — ссылка на шаблон (или `null`)
- `fieldOverrides` — JSONB с переопределениями по каждому полю

Структура `fieldOverrides`:

```json
{
  "names": {
    "isException": true,
    "value": [{ "lang": "ru", "val": "Кофейня Арома1" }],
    "platforms": {
      "yandex": [{ "lang": "en", "val": "Aroma Coffee" }]
    }
  },
  "phones": {
    "isException": false
  }
}
```

| `isException` | Что используется |
|---------------|-----------------|
| `false` | Значение берётся из шаблона |
| `true` | Используется `value` из этой записи |

`platforms` — переопределение под конкретную платформу. Перекрывает и шаблон, и `value`.

Обновление через `PATCH /companies/:id/default` работает **мёрджем на уровне поля** — поля которые не переданы не трогаются.

### Слой 3 — Платформы (`company_platforms`)

Только данные подключения, контент здесь не хранится:

| Поле | Описание |
|------|----------|
| `platformKey` | Строковый ключ: `yandex`, `twogis`, `google`, ... |
| `isEnabled` | Включена ли платформа (данные идут при синке) |
| `orgId` | ID филиала на этой платформе |
| `orgName` | Название как отображается там |
| `status` | `not_connected` / `connected` / `pending` / `action_required` / `disconnected` / `error` |
| `connectedAt` | Когда подключена |
| `lastSyncAt` | Последняя синхронизация |
| `syncError` | Текст ошибки если была |

`platformKey` — строка, не enum. Добавить новую платформу = один запрос, схема не меняется.

### Что возвращает `GET /companies/:id`

```json
{
  "id": "...",
  "name": "Кофейня Арома на Ленина",
  "status": "active",
  "card": {
    "templateId": "uuid | null",
    "fields": {
      "names": {
        "isException": true,
        "default": [{ "lang": "ru", "val": "Кофейня Арома1" }],
        "platforms": {
          "yandex": [{ "lang": "en", "val": "Aroma Coffee" }]
        }
      },
      "phones": {
        "isException": false,
        "default": [{ "value": "+79001234567" }]
      }
    }
  },
  "platforms": [
    {
      "platformKey": "yandex",
      "isEnabled": false,
      "status": "not_connected",
      "orgId": null
    },
    {
      "platformKey": "twogis",
      "isEnabled": true,
      "status": "connected",
      "orgId": "70000001056220281"
    }
  ]
}
```

`default` в ответе всегда заполнен — либо значением компании (если `isException: true`), либо значением из шаблона (если `isException: false`). Фронт показывает что реально будет использоваться.

### Приоритет при резолве (для синка на платформу)

```
platforms[platformKey]  →  value (isException: true)  →  template.fields
```

Метод `resolveForPlatform(platformKey, templateFields, overrides)` возвращает плоский объект который идёт на платформу при синхронизации.

---

## Импорт из 2GIS

### `POST /import/2gis`

Импортирует одну организацию:
1. Создаёт бренд из названия организации
2. Для каждого филиала — тянет данные из Catalog API и создаёт компанию

### `POST /import/2gis/sync`

Синхронизирует все организации из личного кабинета 2GIS:
- Уже импортированные филиалы (по `orgId` в `company_platforms`) — пропускает
- Неактивная организация → бренд со статусом `suspended`
- Возвращает сводку: `brandsCreated`, `companiesCreated`, `companiesSkipped`

> **Известная проблема:** при импорте данные из Catalog API (расписание, категории, телефоны) сейчас не сохраняются в `company_defaults`. Нужно добавить вызов `updateDefault` после создания компании.

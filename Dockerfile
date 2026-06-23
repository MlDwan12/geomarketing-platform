# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║  Dockerfile — geomarketing-platform (все сервисы кроме map-parser)         ║
# ║                                                                            ║
# ║  Многостадийная сборка. Финальный образ содержит только:                  ║
# ║    - production node_modules (без devDependencies)                        ║
# ║    - скомпилированный JS в dist/                                           ║
# ║                                                                            ║
# ║  Использование:                                                            ║
# ║    docker build --build-arg APP=api-gateway -t geo/api-gateway .           ║
# ║    docker build --build-arg APP=core-service -t geo/core-service .         ║
# ║  Или через docker compose (build args задаются в docker-compose.yml)       ║
# ╚══════════════════════════════════════════════════════════════════════════════╝

# ── Этап 1: все зависимости (включая devDependencies для сборки) ──────────────
#
# Почему отдельный этап:
#   Зависимости меняются реже, чем исходный код. Docker кеширует этот слой
#   и пропускает его при повторных сборках, если package.json/yarn.lock не изменились.
#
# Почему build-tools (python3, make, g++):
#   bcrypt и pg компилируют нативные .node-модули через node-gyp.
#   На Alpine (musl libc) нет компилятора по умолчанию.
FROM node:20-alpine AS deps
WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

# ── Этап 2: сборка конкретного приложения ─────────────────────────────────────
#
# ARG APP — имя приложения (api-gateway, core-service и т.д.).
# ENV APP=${APP} нужен, чтобы значение было доступно в CMD финального образа
# (ARG не переносится между этапами и недоступен в CMD).
FROM node:20-alpine AS builder
WORKDIR /app

ARG APP
ENV APP=${APP}

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN yarn nest build ${APP}

# ── Этап 3: только production-зависимости ─────────────────────────────────────
#
# Отдельный этап позволяет исключить devDependencies (~60-70% объёма node_modules):
# typescript, eslint, jest, ts-node и т.д. не нужны в runtime.
#
# build-tools снова нужны: bcrypt/pg пересобираются с нуля в чистом окружении.
FROM node:20-alpine AS prod-deps
WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --production

# ── Этап 4: финальный минимальный образ ───────────────────────────────────────
#
# Содержит только:
#   - node_modules БЕЗ devDependencies (из этапа prod-deps)
#   - dist/ со скомпилированным кодом (из этапа builder)
#   - Node.js runtime
#
# НЕ содержит: исходники .ts, компилятор, тесты, build-tools.
FROM node:20-alpine AS runner
WORKDIR /app

ARG APP
ENV APP=${APP} \
    NODE_ENV=production

# Копируем только то, что нужно для запуска
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

RUN mkdir -p /app/uploads && chown -R node:node /app/uploads
# Запуск от непривилегированного пользователя (встроен в node:alpine).
# Снижает риски при гипотетическом RCE: процесс не имеет root-привилегий.
USER node

# Используем shell form (sh -c), чтобы переменная $APP раскрылась в runtime.
CMD ["sh", "-c", "node dist/apps/${APP}/main.js"]

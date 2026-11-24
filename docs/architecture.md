# Архитектура персонального дашборда

Версия: 1.1  
Статус: целевая архитектура MVP  
Изменение 1.1: постоянное хранилище — PostgreSQL 18 и Prisma ORM. Очередь задач и сроки хранения тоже живут в PostgreSQL.  
Основание: [TECHNICAL_SPECIFICATION.md](./TECHNICAL_SPECIFICATION.md)  
Технологический стандарт: [TECHNOLOGIES.md](./TECHNOLOGIES.md)

## 1. Архитектурное резюме

Приложение строится как monorepo и состоит из трёх независимо запускаемых процессов:

1. `web` — пользовательский интерфейс и серверный рендеринг.
2. `api` — HTTP API, OAuth callback и webhook.
3. `worker` — второй процесс из той же backend-кодовой базы для фоновых и отложенных задач.

Основное хранилище является единственным постоянным источником истины. Reverse proxy предоставляет единый публичный origin и направляет `/api/v1/*` в backend, а остальные запросы — во frontend.

Основной архитектурный стиль backend — модульный монолит. Это даёт явные границы между доменами без операционной сложности микросервисов.

Ключевые решения:

- один репозиторий и один lock-файл;
- независимые deploy artifacts для `web` и `api`;
- один backend-образ запускается двумя командами: API и worker;
- frontend не обращается к базе данных напрямую;
- бизнес-логика находится только в backend-модулях;
- frontend и backend используют общие API-контракты, но не общие модели БД;
- фоновые задачи на MVP хранятся в основном persistent store;
- production-развёртывание начинается с одного сервера и managed database;
- возможность горизонтального масштабирования сохраняется без сложной orchestration platform и микросервисов на старте.

Конкретные frameworks, библиотеки, версии и infrastructure tools перечислены только в [TECHNOLOGIES.md](./TECHNOLOGIES.md).

## 2. Контекст системы

```mermaid
flowchart LR
    User[Пользователь]
    Browser[Браузер / PWA]
    Google[Google OAuth и Calendar]
    Telegram[Telegram Bot API]
    Weather[Weather API]
    News[RSS / News API]

    User --> Browser
    Browser --> App[Персональный дашборд]
    App --> Google
    App --> Telegram
    App --> Weather
    App --> News
```

Система не предоставляет внешним клиентам прямой доступ к базе данных или worker. Все пользовательские операции проходят через HTTP API.

## 3. Контейнерная схема

```mermaid
flowchart TB
    Browser[Браузер]
    Proxy[Reverse proxy / TLS]
    Web[Web frontend]
    API[HTTP API]
    Worker[Background worker]
    Store[(Primary data store)]
    Google[Google APIs]
    Telegram[Telegram API]
    Providers[Weather и News providers]

    Browser -->|HTTPS /| Proxy
    Browser -->|HTTPS /api/v1| Proxy
    Proxy -->|UI, SSR, static| Web
    Proxy -->|REST, OAuth, webhooks| API
    Web -->|Внутренний REST + cookie| API
    API --> Store
    Worker --> Store
    API --> Google
    API --> Telegram
    API --> Providers
    Worker --> Google
    Worker --> Telegram
    Worker --> Providers
```

### Ответственность процессов

`web`:

- маршрутизация интерфейса;
- серверный и клиентский рендеринг;
- SSR и streaming;
- формы и пользовательские взаимодействия;
- локальные стили и темы;
- service worker для Web Push;
- вызовы HTTP API.

`api`:

- OAuth и сессии;
- REST API;
- валидация запросов;
- бизнес-операции;
- webhook Google и Telegram;
- доступ к постоянному хранилищу;
- постановка фоновых задач.

`worker`:

- выполнение отложенных уведомлений;
- завершение таймеров;
- синхронизация календаря;
- обновление AI-новостей;
- повторная доставка сообщений;
- очистка и восстановление зависших задач.

`Primary data store`:

- пользовательские и доменные данные;
- сессии и одноразовые токены;
- кэш внешних данных;
- очередь фоновых задач;
- идемпотентность уведомлений.

## 4. Структура репозитория

Рекомендуемая структура:

```text
dashboard/
├─ apps/
│  ├─ web/
│  │  ├─ public/
│  │  │  ├─ icons/
│  │  │  └─ sw.js
│  │  ├─ src/
│  │  │  ├─ app/
│  │  │  │  ├─ (public)/
│  │  │  │  │  ├─ login/
│  │  │  │  │  ├─ privacy/
│  │  │  │  │  └─ terms/
│  │  │  │  ├─ (protected)/
│  │  │  │  │  ├─ dashboard/
│  │  │  │  │  ├─ settings/
│  │  │  │  │  │  ├─ widgets/
│  │  │  │  │  │  ├─ routines/
│  │  │  │  │  │  ├─ integrations/
│  │  │  │  │  │  └─ profile/
│  │  │  │  │  └─ layout.tsx
│  │  │  │  ├─ error.tsx
│  │  │  │  ├─ global-error.tsx
│  │  │  │  ├─ layout.tsx
│  │  │  │  └─ not-found.tsx
│  │  │  ├─ features/
│  │  │  │  ├─ auth/
│  │  │  │  ├─ calendar/
│  │  │  │  ├─ dashboard/
│  │  │  │  ├─ news/
│  │  │  │  ├─ notifications/
│  │  │  │  ├─ routines/
│  │  │  │  ├─ timer/
│  │  │  │  ├─ weather/
│  │  │  │  └─ widget-settings/
│  │  │  ├─ components/
│  │  │  │  ├─ ui/
│  │  │  │  ├─ layout/
│  │  │  │  └─ feedback/
│  │  │  ├─ lib/
│  │  │  │  ├─ api/
│  │  │  │  ├─ auth/
│  │  │  │  ├─ browser/
│  │  │  │  └─ format/
│  │  │  ├─ providers/
│  │  │  └─ styles/
│  │  │     ├─ _breakpoints.scss
│  │  │     ├─ _mixins.scss
│  │  │     ├─ _tokens.scss
│  │  │     ├─ _typography.scss
│  │  │     └─ globals.scss
│  │  ├─ next.config.ts
│  │  ├─ package.json
│  │  └─ tsconfig.json
│  │
│  └─ api/
│     ├─ prisma/
│     │  ├─ schema.prisma
│     │  └─ migrations/
│     ├─ src/
│     │  ├─ main.ts
│     │  ├─ worker-main.ts
│     │  ├─ app/
│     │  │  ├─ create-app.ts
│     │  │  ├─ register-routes.ts
│     │  │  └─ shutdown.ts
│     │  ├─ config/
│     │  │  ├─ env.ts
│     │  │  └─ constants.ts
│     │  ├─ modules/
│     │  │  ├─ auth/
│     │  │  ├─ calendar/
│     │  │  ├─ dashboard/
│     │  │  ├─ integrations/
│     │  │  ├─ news/
│     │  │  ├─ notifications/
│     │  │  ├─ routines/
│     │  │  ├─ timer/
│     │  │  ├─ users/
│     │  │  ├─ weather/
│     │  │  └─ widgets/
│     │  ├─ infrastructure/
│     │  │  ├─ crypto/
│     │  │  ├─ db/
│     │  │  ├─ http-clients/
│     │  │  ├─ jobs/
│     │  │  ├─ logging/
│     │  │  └─ push/
│     │  ├─ middleware/
│     │  ├─ shared/
│     │  │  ├─ errors/
│     │  │  ├─ types/
│     │  │  └─ utils/
│     │  └─ tests/
│     ├─ package.json
│     └─ tsconfig.json
│
├─ packages/
│  ├─ contracts/
│  │  ├─ src/
│  │  │  ├─ auth/
│  │  │  ├─ common/
│  │  │  ├─ routines/
│  │  │  ├─ timer/
│  │  │  └─ widgets/
│  │  └─ package.json
│  └─ config/
│     ├─ eslint/
│     ├─ typescript/
│     └─ package.json
│
├─ infra/
│  ├─ docker/
│  │  ├─ web.Dockerfile
│  │  └─ api.Dockerfile
│  ├─ nginx/
│  │  └─ default.conf
│  ├─ compose.dev.yml
│  └─ compose.prod.yml
│
├─ .env                 # локальный файл, не попадает в Git
├─ package.json
├─ package-lock.json
├─ TECHNICAL_SPECIFICATION.md
└─ architecture.md
```

### Почему worker находится внутри `apps/api`

API и worker используют одни и те же сервисы, repositories, интеграции и модели. Выделение отдельного `apps/worker` заставило бы либо дублировать код, либо преждевременно создавать большой общий backend-пакет.

Поэтому собирается один backend-образ, но запускается двумя командами:

```text
node dist/main.js
node dist/worker-main.js
```

Процессы остаются независимыми: их можно перезапускать и масштабировать отдельно.

## 5. Правила зависимостей

### 5.1. Общие правила

- `apps/web` не импортирует код из `apps/api`.
- `apps/api` не импортирует frontend-код.
- Оба приложения могут импортировать только публичные API из `packages/contracts` и `packages/config`.
- `packages/contracts` не зависит от UI, HTTP framework и реализации хранилища.
- Модели Prisma и внутренние типы строк не публикуются во frontend.
- Секреты и server-only код не размещаются в общих пакетах.

Направление зависимостей:

```mermaid
flowchart LR
    Web[apps/web] --> Contracts[packages/contracts]
    API[apps/api HTTP] --> Contracts
    Worker[apps/api worker] --> Contracts
    API --> Modules[Backend modules]
    Worker --> Modules
    Modules --> Infra[Infrastructure adapters]
    Infra --> Store[(Primary data store)]
```

### 5.2. Связи backend-модулей

- Route вызывает controller.
- Controller валидирует HTTP DTO и вызывает service.
- Service содержит бизнес-логику и вызывает repository/integration.
- Repository работает с таблицами своего модуля через Prisma Client.
- Один модуль не обращается напрямую к repository другого модуля.
- Межмодульное взаимодействие выполняется через публичный service.
- Infrastructure реализует интерфейсы внешних зависимостей.

Допустимое направление:

```text
route → controller → service → repository → Primary data store
                           ↘ integration → External API
                           ↘ job queue → Persistent queue
```

Обратные импорты запрещены.

## 6. Frontend-архитектура

### 6.1. Маршрутизация и layouts

Папка `app` отвечает только за:

- URL и layouts;
- загрузку первичных данных;
- route-level loading/error/not-found states;
- composition feature-компонентов;
- metadata.

Большая бизнес-логика и сложные компоненты в `app` не размещаются.

Группы маршрутов:

- `(public)` — страницы без сессии;
- `(protected)` — маршруты, требующие авторизации.

Проверка защищённого layout выполняется на сервере через endpoint `GET /api/v1/auth/session`. Cookie входящего запроса пересылается во внутренний API. При отсутствии сессии выполняется server-side redirect на `/login`.

### 6.2. Серверные и клиентские компоненты

Серверные компоненты применяются для:

- layouts и страниц;
- первичной загрузки dashboard;
- чтения server-only переменных;
- уменьшения клиентского JavaScript.

Клиентские компоненты применяются только там, где нужны:

- клиентское состояние и обработчики событий;
- таймер;
- drag-and-drop;
- Geolocation API;
- Notification API;
- анимация погоды;
- optimistic UI.

Граница клиентских компонентов размещается как можно ниже по дереву. Конкретная директива определяется frontend-фреймворком из [TECHNOLOGIES.md](./TECHNOLOGIES.md).

### 6.3. Feature-first организация

Каждый домен во frontend имеет локальную структуру:

```text
features/routines/
├─ api/
├─ components/
├─ hooks/
├─ model/
├─ styles/
└─ index.ts
```

Правила:

- feature экспортирует только публичные элементы через `index.ts`;
- feature может импортировать `components/ui`, `lib` и `contracts`;
- прямые циклические импорты между features запрещены;
- объединение нескольких features выполняется на уровне страницы или dashboard composition;
- универсальный UI не должен знать о routines, timer или calendar.

### 6.4. Работа с API

В `src/lib/api` находятся два клиента:

- `server-api-client.ts` — работает внутри frontend server, использует `INTERNAL_API_URL` и пересылает cookie;
- `browser-api-client.ts` — использует относительные URL `/api/v1/*`.

Оба клиента:

- добавляют `requestId`, если он отсутствует;
- обрабатывают единый формат ошибок;
- проверяют ответ runtime-схемой из `packages/contracts`;
- не повторяют автоматически изменяющие запросы без idempotency key;
- поддерживают `AbortSignal` и timeout.

Первичная загрузка `/dashboard`:

1. Серверная страница вызывает агрегирующий endpoint.
2. Backend возвращает независимые секции виджетов.
3. Страница передаёт initial data клиентским виджетам.
4. Дальнейшие обновления и мутации идут из браузера напрямую в `/api/v1`.

Для MVP не требуется отдельная библиотека глобального server-state. Её следует добавить только при появлении повторяющейся логики кэширования, сложной пагинации или большого количества optimistic updates.

### 6.5. Стили

Обязательный подход:

- стили компонентов имеют локальную область видимости;
- глобальные стили содержат только reset, typography, themes и design tokens;
- runtime-тема использует semantic custom properties;
- inline styles допускаются только для действительно динамических числовых значений;
- конкретная технология стилей и правила синтаксиса определены в [TECHNOLOGIES.md](./TECHNOLOGIES.md).

Пример размещения:

```text
features/weather/components/WeatherWidget/
├─ WeatherWidget.tsx
├─ WeatherWidget.module.scss
├─ weather-animation.ts
└─ index.ts
```

Design tokens определяются один раз:

```text
styles/_tokens.scss      — compile-time style tokens
styles/globals.scss      — CSS variables для light/dark themes
```

### 6.6. Service worker

Service worker отвечает только за:

- получение Web Push;
- отображение browser notification;
- обработку перехода по уведомлению;
- кэширование минимального app shell при необходимости.

Он не является источником истины для таймера и не содержит бизнес-правила.

## 7. Backend-архитектура

### 7.1. Модульный монолит

Каждый доменный модуль имеет одинаковую форму:

```text
modules/routines/
├─ routine.routes.ts
├─ routine.controller.ts
├─ routine.service.ts
├─ routine.repository.ts
├─ routine.contracts.ts
├─ routine.types.ts
├─ routine.errors.ts
└─ routine.service.test.ts
```

Небольшой модуль может не создавать все файлы сразу. Деление выполняется по ответственности, а не ради количества слоёв.

### 7.2. HTTP pipeline

Порядок middleware:

1. trusted proxy configuration;
2. request ID;
3. structured access log;
4. security headers;
5. body size limits;
6. cookie parsing;
7. CORS — только если используется отдельный origin;
8. session/authentication;
9. CSRF/origin validation для мутаций;
10. rate limiting;
11. routes;
12. not-found handler;
13. centralized error handler.

`X-Powered-By` отключается. Значение `trust proxy` задаётся согласно реальному количеству доверенных прокси, а не глобальным `true`.

### 7.3. Формат API

Публичный префикс:

```text
/api/v1
```

Успешный единичный ответ:

```json
{
  "data": {},
  "meta": {
    "requestId": "..."
  }
}
```

Ошибка:

```json
{
  "error": {
    "code": "ROUTINE_NOT_FOUND",
    "message": "Рутина не найдена",
    "fieldErrors": {}
  },
  "meta": {
    "requestId": "..."
  }
}
```

Правила:

- JSON-поля API используют единое соглашение `camelCase`;
- даты-время передаются в ISO 8601 UTC;
- локальная дата передаётся как `YYYY-MM-DD`;
- pagination — cursor-based для растущих списков;
- `PATCH` используется для частичных изменений;
- повторяемые POST-запросы принимают `Idempotency-Key`;
- API не возвращает модель Prisma или строку таблицы напрямую;
- DTO преобразуется явно в service/controller.

### 7.4. Общие контракты

`packages/contracts` содержит:

- runtime-схемы request/response;
- выведенные из схем статические типы;
- enum/union API-статусов;
- контракт ошибок;
- только сериализуемые DTO.

Контракты не содержат:

- модели Prisma и внутренние типы строк;
- framework Request/Response;
- UI components;
- секреты или внутренние поля интеграций.

## 8. Хранилище данных

### 8.1. Подключение

- Схема живёт в `apps/api/prisma/schema.prisma`. Модели называются в PascalCase, поля — в camelCase. Таблицы и колонки в PostgreSQL — в snake_case через `@@map` и `@map`.
- Первичный ключ — UUID версии 7 (`uuidv7()`). Новые значения упорядочены по времени, публичный идентификатор остаётся UUID. Уже записанные UUID версии 4 сохраняются. Моменты времени — `timestamptz`. Локальная дата рутины — `date`. Флаги — `boolean`. Строка с настоящим пределом длины остаётся `varchar(n)`; секрет и длинный текст — `text`. `varchar(255)` в схеме нет.
- Каждый процесс создаёт один `PrismaClient` поверх `@prisma/adapter-pg` в `apps/api/src/infrastructure/db/prisma-client.ts`. В watch mode клиент переиспользуется внутри процесса, чтобы пул не размножался.
- Пул адаптера ограничен десятью соединениями на процесс. Сумма соединений API, worker и миграции остаётся ниже `max_connections` = 100. Прямое соединение задаёт `statement_timeout` 10 секунд, `idle_in_transaction_session_timeout` 30 секунд и `work_mem` 8MB. Для transaction-mode PgBouncer эти startup-параметры не отправляются; ограничение запроса на стороне клиента остаётся равным 10 секундам.
- Локальный PostgreSQL в `infra/compose.dev.yml` ставит те же потолки на сервере: запрос вне пула приложения обрывается через 30 секунд. `pg_stat_statements` подгружается при старте и создаётся при первой инициализации тома.
- Миграция отзывает у роли `PUBLIC` все права на схему `public`. Владелец базы сохраняет доступ. Политики RLS с `auth.uid()` не включаются: к базе подключается роль приложения, а worker читает строки всех пользователей. Чужие строки отсекает сервис.
- Клиент открывается при старте и закрывается через `$disconnect` при `SIGTERM`/`SIGINT`.
- API становится ready только после успешного `SELECT 1`.
- На transient errors применяются ограниченные retries с exponential backoff.
- Запросы имеют ограничение максимального времени выполнения.
- Runtime читает `DATABASE_URL`. `prisma migrate` использует прямое соединение: на MVP это тот же адрес, а при появлении transaction-mode пулера — `DIRECT_DATABASE_URL` или предоставленный Neon/Vercel `DATABASE_URL_UNPOOLED`.

### 8.2. Таблицы

`users`:

- профиль, locale, timezone, тема;
- необязательное `weatherLocation`: широта и долгота, округлённые до двух знаков, и подпись места. Поле не входит в публичный профиль;
- внешний идентификатор провайдера здесь не хранится.

`auth_accounts`:

- OAuth/Telegram identity;
- зашифрованные токены;
- внешний ключ на `users` с `ON DELETE CASCADE`;
- unique `(provider, providerUserId)`;
- unique `(userId, provider)`.

`sessions`:

- hash session token, `userId`, `expiresAt`;
- внешний ключ на `users` с `ON DELETE CASCADE`;
- unique по hash;
- индекс по `userId` для внешнего ключа и выборки сессий пользователя;
- индекс по `expiresAt` для очистки просроченных сессий.

`one_time_tokens`:

- одноразовый OAuth state, state календаря и ссылка Telegram: hash, назначение `oauth_state` | `calendar_oauth` | `telegram_link`, зашифрованный payload, `expiresAt`, `consumedAt`;
- строки пользователя нет: идентификатор сессии лежит только внутри зашифрованного payload;
- unique по hash;
- индекс по `expiresAt` для очистки.

`widget_preferences`:

- одна строка на пару пользователь + тип виджета;
- порядок, видимость, размер и ограниченный `Json` настроек;
- внешний ключ на `users` с `ON DELETE CASCADE`;
- unique `(userId, widgetType)`;
- `position` обязателен, поэтому unique `(userId, position)` запрещает две карточки на одной позиции;
- пакетное изменение порядка и видимости выполняется одной транзакцией.

`routine_rules`:

- шаблоны повторений;
- внешний ключ на `users` с `ON DELETE CASCADE`;
- unique `(id, userId)` для составной ссылки из экземпляров;
- индекс `routine_rules_user_status` по `(userId, status)` для живых строк (`deletedAt IS NULL`);
- индекс `routine_rules_user_start_date` по `(userId, startDate)` для живых строк (`deletedAt IS NULL`);
- частичный индекс `routine_rules_active_reminders` по `reminderLocalTime` для живых активных правил, у которых задано напоминание.

`routine_occurrences`:

- состояние рутины на конкретную локальную дату;
- внешний ключ `(routineRuleId, userId)` → `routine_rules (id, userId)`;
- unique `(routineRuleId, localDate)`;
- индекс `(userId, localDate)`.

`timer_presets`:

- длительности работы и перерывов одного пользователя;
- внешний ключ на `users` с `ON DELETE CASCADE`;
- unique `userId`: у пользователя один пресет.

`timer_sessions`:

- история и текущая сессия;
- внешний ключ на `users` с `ON DELETE CASCADE`;
- индекс `(userId, startedAt DESC)`;
- partial unique `timer_sessions_one_active_user` по `(userId)` при `completedAt IS NULL`: не больше одной незавершённой сессии.

`integrations`:

- Google Calendar и Telegram;
- credentials шифруются на уровне приложения;
- внешний ключ на `users` с `ON DELETE CASCADE`;
- unique `(id, userId)` для составной ссылки из событий календаря;
- partial unique `integrations_user_type` по `(userId, type)` для живых строк (`deletedAt IS NULL`).

`calendar_events`:

- нормализованный пользовательский кэш;
- внешний ключ `(integrationId, userId)` → `integrations (id, userId)`;
- unique `(integrationId, externalEventId)`;
- индекс `(userId, startAt)`.

`news_items`:

- глобальный кэш новостей, без внешнего ключа на пользователя;
- unique по hash канонического URL;
- индекс `(publishedAt DESC, language)`;
- GIN-индекс по массиву тем.

`push_subscriptions`:

- Web Push endpoint и зашифрованные ключи;
- внешний ключ на `users` с `ON DELETE CASCADE`;
- unique по hash endpoint;
- индекс `(userId, revokedAt)`.

`scheduled_jobs`:

- тип, payload, `runAt`, status, attempts;
- lease-поля `lockedAt`, `lockedBy`, `lockExpiresAt`;
- `userId` необязателен: задачи планировщика и heartbeat пользователя не имеют;
- внешний ключ на `users` с `ON DELETE CASCADE` только для строк с пользователем;
- unique `idempotencyKey`;
- индекс `(status, runAt)`;
- partial index `scheduled_jobs_pending_run_at` по `runAt` для `status = pending`;
- индекс по `deleteAt` для очистки завершённых задач.

`notification_deliveries`:

- канал, status, attempts, provider message ID;
- внешний ключ на `users` с `ON DELETE CASCADE`;
- unique `idempotencyKey`;
- индекс `(userId, createdAt DESC)`;
- индекс по `deleteAt`. Срок журнала доставки по умолчанию — 30 дней от `createdAt`, его записывает приложение. История таймеров и рутин автоматического срока не получает и живёт до физической очистки аккаунта, см. раздел 8.9.

`audit_events`:

- события безопасности: вход, выход, привязка и отвязка интеграции, удаление аккаунта;
- в строке только `userId`, действие, цель (`google`, `google_calendar`, `telegram`) и даты. Токены, cookie, адреса и payload не пишутся;
- `userId` есть у событий живого аккаунта и удаляется вместе с ним. После очистки остаётся одна запись `account_deleted` с `userId: null` и без внешнего ключа;
- индекс `(userId, createdAt DESC)`;
- индекс по `deleteAt`. Срок журнала — 90 дней от `createdAt`.

PostgreSQL не удаляет строки по TTL-индексу. Индексы по `expiresAt` и `deleteAt` обслуживают выборку worker. Состав индексов и ограничения зафиксированы в [TECHNOLOGIES.md](./TECHNOLOGIES.md).

### 8.3. Нормализация

Колонками `users` хранятся:

- тема, локаль, часовой пояс и формат времени;
- округлённая локация погоды.

Отдельными таблицами хранятся:

- настройки виджетов;
- пресеты таймера;
- история рутин;
- события календаря;
- новости;
- сессии;
- уведомления;
- фоновые задачи.

`Json` допустим только для ограниченного объекта настроек, который перед записью проверяет runtime-схема. Неограниченный список внутри строки `users` запрещён.

### 8.4. Транзакции

Интерактивная транзакция Prisma используется только там, где одна операция меняет несколько строк:

- запуск таймера и создание scheduled job;
- критичное завершение OAuth-привязки;
- удаление интеграции и отмена связанных задач;
- пакетное сохранение порядка виджетов;
- физическая очистка аккаунта.

Обычное обновление одной строки транзакцию не открывает. Уровень изоляции — `READ COMMITTED`, уровень PostgreSQL по умолчанию.

### 8.5. Шифрование credentials

Access token, refresh token, credentials интеграций и ключи Web Push шифруются в приложении до записи. Алгоритм — AES-256-GCM. Ключ — `DATA_ENCRYPTION_KEY`, 32 байта в base64 или hex, отдельно от PostgreSQL.

В поле хранится строка `enc:v1:<iv>.<tag>.<ciphertext>` в base64url. Дополнительные аутентифицированные данные привязаны к назначению поля: `auth_accounts.access_token`, `auth_accounts.refresh_token`, `integrations.credentials`, `push_subscriptions.keys`, `one_time_tokens.payload`. Ciphertext одного поля нельзя подставить в другое. Открытый секрет в базу и логи не попадает.

Первая миграция добавляет CHECK на эти колонки: значение либо NULL, если колонка необязательна, либо ciphertext `enc:v1` не длиннее 8192 символов. Имена ограничений: `auth_accounts_access_token_ciphertext`, `auth_accounts_refresh_token_ciphertext`, `integrations_credentials_ciphertext`, `push_subscriptions_keys_ciphertext`, `one_time_tokens_payload_ciphertext`. Проверка формата не заменяет ключ приложения и не подтверждает, что ciphertext расшифровывается.

### 8.6. Мягкое удаление

`users`, `routine_rules` и `integrations` при пользовательском удалении не стираются физически. Операция ставит `deletedAt` и `updatedAt`. Повтор идемпотентен. Undo снова записывает `deletedAt: null`, пока живая строка с тем же уникальным ключом не заняла место.

Выборки живых строк фильтруют `deletedAt: null`. Физическая очистка аккаунта описана в разделе 8.9.

Уникальность живых строк задаёт partial unique index в SQL миграции: `WHERE deleted_at IS NULL`. Декларативный `@@unique` Prisma ORM 7 такое условие не выражает, а уникальный индекс PostgreSQL считает разные `NULL` различными, поэтому пара `(userId, type, deletedAt)` две живые строки не запрещает. Имена индексов перечислены в разделе 8.2: `routine_rules_user_status`, `routine_rules_user_start_date`, `routine_rules_active_reminders`, `timer_sessions_one_active_user`, `integrations_user_type`, `scheduled_jobs_pending_run_at`.

Следующая миграция, которую предлагает `prisma migrate dev`, проверяется до коммита. Если Prisma генерирует `DROP INDEX` для partial index или `DROP CONSTRAINT` для проверки ciphertext, эта команда из SQL удаляется. Integration-тест читает `pg_indexes` и `pg_constraint` и подтверждает, что частичные индексы и проверки на месте.

### 8.7. Версионированные миграции

Источник схемы — `apps/api/prisma/schema.prisma`. SQL миграций лежит в `apps/api/prisma/migrations`. Prisma записывает применённые миграции в `_prisma_migrations`.

Команды workspace `@dashboard/api`:

- `db:generate` — `prisma generate`; клиент собирается до typecheck и production build;
- `db:migrate:dev` — `prisma migrate dev`, только локальная разработка;
- `db:migrate` — `prisma migrate deploy`, CI и production.

Первая миграция — `apps/api/prisma/migrations/20261114202100_initial`. Она создаёт таблицы, внешние ключи с `ON DELETE CASCADE`, unique, query-индексы, partial indexes, поля ciphertext и колонки `deleted_at`. Первичный ключ получает `DEFAULT gen_random_uuid()`. Миграция `20261116161000_postgres_patterns` меняет это значение по умолчанию на `uuidv7()`, индексирует `sessions.user_id`, добавляет частичный индекс напоминаний и отзывает права `PUBLIC` на схему `public`. Старые UUID версии 4 остаются. Новая миграция не удаляет колонку в том же выпуске, где код перестаёт её читать. Сгенерированный клиент импортируется только внутри `apps/api`.

### 8.8. Проверка запросов

Основные чтения сессии, дашборда, рутин, таймера, новостей, интеграций и уведомлений собраны в каталоге запросов. У каждого unique- и query-индекса есть один запрос. Команда `npm run db:check --workspace @dashboard/api` выполняет `EXPLAIN (ANALYZE, BUFFERS)`.

План принимается, если он читает ожидаемый индекс (`Index Scan`, `Index Only Scan` или `Bitmap Index Scan`) и не делает отдельную сортировку там, где порядок уже задан индексом. Запросы к частичным индексам включают их фильтр: `deletedAt IS NULL`, `completedAt IS NULL` или активное напоминание.

На малой таблице — меньше 1000 строк — планировщик может выбрать `Seq Scan`. Тогда проверка подтверждает, что индекс есть в `pg_indexes`, и повторяет план с `enable_seqscan = off`. Если порядок уже задан индексом, а план всё же сортирует поверх `Bitmap Index Scan`, проверка повторяет запрос с `enable_bitmapscan = off`. Два частичных индекса рутин делят ведущий столбец `user_id`, и на пустой таблице их стоимость совпадает. Если для `routine_rules_user_status` выбран соседний индекс, проверка в той же транзакции вставляет короткую выборку живых правил, выполняет `ANALYZE` и читает план снова. Транзакция откатывается: строки и статистика не сохраняются. В принятом плане должен читаться заданный индекс.

### 8.9. Целостность, очистка аккаунта и сроки хранения

Внешние ключи не дают строке ссылаться на отсутствующего пользователя, отсутствующее правило или чужую интеграцию. Составные ключи `routine_occurrences` и `calendar_events` дополнительно требуют, чтобы `userId` совпадал с владельцем родителя. Проверка целостности секреты не читает: в выборку попадают идентификаторы, тип и позиция виджета, даты журнала доставки.

Нарушением считается:

- повторяются тип или позиция виджета одного пользователя;
- у записи `notification_deliveries` нет `deleteAt` либо срок не равен 30 дням от `createdAt`;
- у записи `audit_events` нет `deleteAt` либо срок не равен 90 дням от `createdAt`;
- обязательный partial unique index отсутствует;
- внешний ключ не входит ни в один индекс;
- обязательная проверка формата ciphertext отсутствует.

Сроки:

- worker удаляет `sessions` с `expiresAt <= now()`;
- worker удаляет `one_time_tokens` с `expiresAt <= now()`; таблица пользователю не принадлежит;
- журнал доставки живёт 30 дней;
- журнал аудита живёт 90 дней;
- завершённые и проваленные задачи очереди worker удаляет по `scheduled_jobs.deleteAt`;
- `timer_sessions`, `timer_presets`, `routine_rules`, `routine_occurrences` и `calendar_events` живут до очистки аккаунта.

Часовая задача `purge-expired` удаляет эти строки пачками. Она не трогает историю таймера, рутин и календаря, общий кэш новостей, ожидающие и выполняемые задачи, lock планировщика и heartbeat.

`purgeAccount` выполняется в одной транзакции и только для строки с уже установленным `deletedAt`. Удаление `users` каскадом стирает `auth_accounts`, `sessions`, `widget_preferences`, `timer_presets`, `routine_rules`, `routine_occurrences`, `timer_sessions`, `integrations`, `calendar_events`, `push_subscriptions`, `notification_deliveries`, пользовательские `scheduled_jobs` и `audit_events` этого пользователя. Задачи без пользователя (`userId: null`) — lock планировщика и heartbeat — не удаляются. После удаления пользователя транзакция добавляет `account_deleted` с пустым `userId`; эту строку позже удаляет worker. `news_items` — общий кэш, он не удаляется. `one_time_tokens` тоже не удаляется: срок жизни задаёт `expiresAt`. Живой аккаунт (`deletedAt: null`) не удаляется. Повтор после очистки ничего не стирает.

`DELETE /api/v1/account` вызывает очистку только для пользователя текущей сессии и только после мягкого удаления. Если очистка не удалась, мягкое удаление возвращается, а клиент получает 503. Отдельной команды очистки в CLI нет.

## 9. Фоновые задачи

### 9.1. Persistent queue на MVP

Очередь использует PostgreSQL, чтобы не добавлять отдельный инфраструктурный сервис до появления измеримой необходимости. Выбор текущей и возможной будущей реализации зафиксирован в [TECHNOLOGIES.md](./TECHNOLOGIES.md).

Взаимодействие скрывается за интерфейсом `JobQueue`, поэтому реализацию можно заменить без изменения доменных сервисов.

### 9.2. Получение задачи worker

Worker атомарно захватывает следующую доступную задачу одним параметризованным запросом Prisma. В SQL ниже указаны физические имена колонок. Статус хранится текстом:

```sql
UPDATE scheduled_jobs
SET status = 'processing',
    locked_by = $worker,
    locked_at = now(),
    lock_expires_at = $leaseUntil
WHERE id = (
  SELECT id
  FROM scheduled_jobs
  WHERE status = 'pending'
    AND run_at <= now()
  ORDER BY run_at
  FOR UPDATE SKIP LOCKED
  LIMIT 1
)
RETURNING *;
```

Условный `UPDATE` делает четыре шага одной операцией:

- выбирает `pending` задачу с `runAt <= now`;
- устанавливает `status = processing`;
- записывает `lockedBy` и срок lease;
- возвращает захваченную строку.

`SKIP LOCKED` позволяет нескольким worker не брать одну и ту же строку. Пустой результат означает, что доступных задач нет.

После выполнения:

- успех → `completed`;
- временная ошибка → новый `runAt` с exponential backoff;
- превышение retries → `failed`;
- завершённая строка получает `deleteAt`.

Если worker завершился аварийно, задача с истёкшим lease возвращается в `pending`.

### 9.3. Идемпотентность

Каждая доставляемая операция имеет стабильный `idempotencyKey`, например:

```text
timer:{timerSessionId}:work-completed:telegram
```

Unique index не позволяет создать повторную доставку. Внешний вызов и его результат фиксируются в `notification_deliveries`.

### 9.4. Периодические задачи

- AI-новости — каждые 15 минут;
- продление Calendar watch channels — по сроку expiration;
- восстановительная Calendar sync — по расписанию;
- поиск истёкших таймеров — короткий интервал как страховочный механизм;
- очистка отозванных подписок — ежедневно;
- удаление просроченных сессий, одноразовых токенов, журналов доставки, аудита и завершённых задач — задача `purge-expired`, один раз в час;
- возврат задач с истёкшим lease — постоянно;
- проверка reminder рутин — согласно локальному времени пользователя.

Периодические задачи используют распределённый lock в основном хранилище, чтобы при нескольких worker только один создавал очередную партию.

## 10. Основные потоки данных

### 10.1. Открытие dashboard

```mermaid
sequenceDiagram
    participant B as Browser
    participant W as Web frontend
    participant A as HTTP API
    participant M as Primary data store

    B->>W: GET /dashboard + session cookie
    W->>A: GET /api/v1/auth/session
    A->>M: Проверка hash сессии
    M-->>A: User/session
    A-->>W: Session DTO
    W->>A: GET /api/v1/dashboard?date=...
    A->>M: Config, routines, cache
    M-->>A: Данные
    A-->>W: Независимые секции виджетов
    W-->>B: Streaming HTML + initial data
    B->>A: Последующие refresh/mutations
```

Endpoint dashboard использует `Promise.allSettled` для независимых источников. Ошибка календаря не превращает весь ответ в 500.

### 10.2. Запуск таймера

```mermaid
sequenceDiagram
    participant B as Browser
    participant A as HTTP API
    participant M as Primary data store
    participant W as Worker
    participant T as Telegram/Web Push

    B->>A: POST /api/v1/timers
    A->>M: Transaction: timer + scheduled job
    M-->>A: TimerSession
    A-->>B: endsAt и state
    W->>M: Claim due job
    W->>M: Проверка актуального состояния таймера
    W->>T: Отправка уведомления
    T-->>W: Delivery result
    W->>M: completed / retry
```

Клиент отображает оставшееся время как `endsAt - now`. Worker, а не вкладка браузера, отвечает за гарантированное уведомление.

### 10.3. Google Calendar

1. Пользователь начинает подключение через backend.
2. Backend создаёт `state`/PKCE и перенаправляет в Google.
3. Callback приходит в backend.
4. Credentials шифруются и сохраняются в `integrations`. Scope — только `calendar.readonly`, отдельно от входа.
5. Callback и `POST /api/v1/calendar/sync` делают ограниченную синхронизацию: не больше трёх страниц по 50 событий. Истёкший `syncToken` (ответ 410) сбрасывается, после чего читается видимое окно.
6. Нормализованные события лежат в `calendar_events`. Dashboard читает только этот кэш.
7. `POST /api/v1/webhooks/google-calendar` проверяет `X-Goog-Channel-Token` и только ставит `sync-calendar` в очередь. Состояние `sync` — рукопожатие, задачу не создаёт. Worker синхронизирует календарь и за 15 минут до начала события ставит напоминание. Если заданы `GOOGLE_CALENDAR_WEBHOOK_URL` и `GOOGLE_CALENDAR_WEBHOOK_TOKEN`, ежедневная задача продлевает канал, который истекает в ближайшие сутки.

### 10.4. Погода

1. Browser получает координаты после согласия.
2. Backend округляет их до двух знаков и хранит в `users.weatherLocation`. В публичный профиль координаты не попадают.
3. Ключ кэша строится по округлённым координатам и единице температуры.
4. Свежий ответ живёт 15 минут в памяти процесса. Отдельной таблицы погоды нет.
5. Если Open-Meteo недоступен, отдаётся устаревший снимок не старше 6 часов. Иначе секция получает статус ошибки и не роняет дашборд.

### 10.5. AI-новости

1. `GET /api/v1/news` читает `news_items`. Если общий кэш старше 15 минут, API обновляет его из разрешённых RSS/Atom-лент.
2. Загрузка идёт только на allowlist-хосты, без следования редиректам. У каждого хоста свой предохранитель.
3. Adapter убирает HTML, нормализует URL, убирает дубли и назначает темы.
4. Новости upsert-ятся в `news_items` по hash канонического URL.
5. API фильтрует сохранённые строки по языку, теме, лимиту и режиму источников. Если обновление не удалось, остаётся прошлый снимок. Worker дополнительно обновляет ленту каждые 15 минут.

## 11. Авторизация и сессия

Backend полностью владеет авторизацией.

Cookie:

- имя `__Host-session`;
- `HttpOnly`;
- `Secure` всегда, включая localhost;
- `SameSite=Lax`;
- `Path=/`;
- без `Domain`.

В cookie хранится случайный session token. Постоянное хранилище содержит только его SHA-256 hash. Срок сессии — 14 суток и не продлевается при запросах. Выход отзывает только текущую сессию.

Google OAuth использует scopes `openid email profile`, PKCE, `state` и `nonce`. `state` живёт 10 минут, расходуется один раз, а payload шифруется. Callback принимает только `code`, `state`, `error`, `error_description`, `iss` и `scope` и всегда перенаправляет на фиксированный путь приложения.

OAuth state входа, state календаря и одноразовая ссылка Telegram хранятся в `one_time_tokens`. В базе лежит только hash, payload шифруется. Recovery token по-прежнему не создаётся. `POST /api/v1/webhooks/telegram` проверяет `X-Telegram-Bot-Api-Secret-Token` и завершает ссылку по команде `/start`. Одноразовые токены:

- короткоживущие;
- хранятся в виде hash;
- автоматически удаляются worker по `expiresAt`.

Для мутаций с cookie backend проверяет, что `Origin` равен `APP_ORIGIN`, и заголовок `X-CSRF-Token`. Токен — HMAC сырого session token на `SESSION_SECRET`. `GET /api/v1/auth/google`, `GET /api/v1/auth/google/callback` и `GET /api/v1/integrations/google/callback` CSRF не требуют: это переход браузера, а адрес возврата не берётся из запроса. Внешние webhook имеют отдельные правила.

Эндпоинты входа и профиля:

- `GET /health/live`, `GET /health/ready`;
- `GET /api/v1/auth/google`, `GET /api/v1/auth/google/callback`;
- `GET /api/v1/integrations/google/callback`;
- `GET /api/v1/auth/session`;
- `POST /api/v1/auth/logout`;
- `GET /api/v1/profile`, `PATCH /api/v1/profile`;
- `DELETE /api/v1/account`.

Профиль не содержит идентификатор пользователя в пути. Каждое чтение и изменение фильтруется идентификатором текущей сессии.

## 12. Развёртывание

### 12.1. Локальная разработка

Локально запускаются:

- frontend dev server;
- HTTP API с watch mode;
- worker с watch mode;
- локальный PostgreSQL 18 через `compose.dev.yml`.

Reverse proxy в локальной разработке необязателен. Frontend dev server может проксировать `/api/v1` в backend, чтобы browser продолжал работать с same-origin URL.

Корневые команды разработки, сборки и тестирования определены в package manifest; выбранный package manager указан в [TECHNOLOGIES.md](./TECHNOLOGIES.md).

### 12.2. Production на одном сервере

Оптимальный MVP-вариант:

- один Linux-сервер;
- container runtime с declarative compose-конфигурацией;
- reverse proxy;
- managed database;
- один контейнер `web`;
- один контейнер `api`;
- один контейнер `worker`.

```mermaid
flowchart TB
    Internet[Internet]
    Proxy[Reverse proxy]
    Web[web container]
    API[api container]
    Worker[worker container]
    Store[(Managed data store)]

    Internet -->|443| Proxy
    Proxy -->|/*| Web
    Proxy -->|/api/v1/*| API
    Web -->|internal network| API
    API --> Store
    Worker --> Store
```

База данных не разворачивается на том же сервере в production, если доступен managed-вариант: резервное копирование, отказоустойчивость и обновления не должны обслуживаться приложением.

### 12.3. Frontend image

Multi-stage build формирует автономный runtime artifact и копирует только production server, статические assets и public-файлы.

Контейнер запускает runtime entrypoint под непривилегированным пользователем.

### 12.4. Backend image

Один multi-stage container build:

1. устанавливает workspace dependencies;
2. компилирует backend и contracts;
3. копирует production dependencies и `dist`;
4. запускается под непривилегированным пользователем.

Один image используется сервисами:

```text
api:    node dist/main.js
worker: node dist/worker-main.js
```

Это гарантирует, что API и worker используют одну версию доменного кода.

### 12.5. Reverse proxy

Reverse proxy:

- завершает TLS;
- ограничивает body size;
- добавляет базовый rate limit;
- перенаправляет `/api/v1` в backend;
- перенаправляет остальные запросы во frontend;
- передаёт `X-Forwarded-*`;
- не буферизует streaming-ответы frontend;
- не публикует внутренние порты контейнеров.

Backend доверяет только известному reverse proxy.

### 12.6. Health checks и shutdown

API:

- `/health/live` — процесс работает;
- `/health/ready` — хранилище доступно, конфигурация валидна.

Web:

- lightweight health endpoint без пользовательских данных.

Worker:

- периодически обновляет heartbeat;
- readiness означает подключение к хранилищу;
- мониторинг проверяет возраст heartbeat.

При `SIGTERM`:

1. API перестаёт принимать новые подключения.
2. Завершает in-flight requests.
3. Worker перестаёт брать новые задачи.
4. Активная задача завершается или освобождает lease.
5. Клиент хранилища закрывается.
6. Процесс завершается до истечения grace period.

Для frontend server предусматривается drain period 10–30 секунд.

## 13. Переменные окружения

Локальная разработка читает единый корневой `.env`. Файл содержит секреты и не
попадает в Git. На хостинге те же значения передаются через переменные окружения.

`web`:

- `NODE_ENV`;
- `INTERNAL_API_URL`;
- `NEXT_PUBLIC_APP_URL`;
- `DEPLOYMENT_VERSION`;
- `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` — при нескольких web-инстансах.

`api` и `worker`:

- `NODE_ENV`;
- `PORT`;
- `APP_ORIGIN`;
- `DATABASE_URL`;
- `DIRECT_DATABASE_URL` — прямое соединение для `prisma migrate`, если runtime-адрес ведёт в transaction-mode пулер; на MVP может совпадать с `DATABASE_URL`;
- `DATABASE_URL_UNPOOLED` — имя прямого соединения в Neon/Vercel; используется как fallback, если `DIRECT_DATABASE_URL` не задан;
- `SESSION_SECRET`;
- `DATA_ENCRYPTION_KEY`;
- `GOOGLE_CLIENT_ID`;
- `GOOGLE_CLIENT_SECRET`;
- `GOOGLE_REDIRECT_URI`;
- `TELEGRAM_BOT_TOKEN`;
- `TELEGRAM_WEBHOOK_SECRET`;
- `WEB_PUSH_PUBLIC_KEY`;
- `WEB_PUSH_PRIVATE_KEY`;
- provider keys для погоды/новостей;
- настройки retries, lease и retention.

Секреты:

- не имеют префикса `NEXT_PUBLIC_`;
- не включаются в image;
- передаются при запуске;
- в production хранятся в secret storage хостинга или защищённом env-файле вне репозитория.

## 14. CI/CD

Pipeline:

1. checkout;
2. воспроизводимая установка по lock-файлу;
3. lint;
4. статическая проверка типов;
5. unit tests;
6. integration tests с PostgreSQL 18;
7. build contracts, API и web;
8. E2E для критичных сценариев;
9. сборка versioned container images;
10. security/dependency scan;
11. публикация images;
12. `prisma migrate deploy`;
13. обновление Compose services;
14. health checks;
15. автоматический rollback при неуспешном health check.

Container images помечаются immutable tag по commit SHA. `latest` не используется как единственный production tag.

Миграции хранилища:

- хранятся в `apps/api/prisma/migrations`;
- применяются командой `prisma migrate deploy`;
- учитываются в `_prisma_migrations`;
- создают и проверяют индексы, включая partial unique indexes;
- не удаляют колонки в том же deployment, где код перестаёт их читать.

## 15. Наблюдаемость

### Логи

- структурированный JSON в stdout;
- `requestId`, `userId` при наличии, route, status, duration;
- job ID, job type, attempt и duration;
- токены, cookies, координаты и payload webhook редактируются;
- stack trace доступен только в server logs.

### Метрики

- HTTP request rate/error rate/latency;
- latency операций хранилища и pool saturation;
- размер очереди по status;
- возраст самой старой pending job;
- успешность Web Push и Telegram;
- длительность Calendar sync;
- freshness новостей и погоды;
- worker heartbeat.

### Ошибки

Frontend и backend используют единый release/version identifier. Ошибка должна связываться с `requestId` и deployment version.

## 16. Безопасность сети и данных

- TLS обязателен.
- API и web доступны снаружи только через reverse proxy.
- Хранилище разрешает подключение только от production-сервера/закрытой сети.
- Все внешние HTTP-клиенты имеют timeout, ограничение ответа и allowlist hosts.
- RSS HTML не вставляется в DOM напрямую.
- Refresh tokens и push keys шифруются authenticated encryption.
- Ключ шифрования отделён от хранилища.
- Webhook проверяет секрет/подпись до чтения бизнес-payload.
- Rate limit различается для входа, одноразовых ссылок интеграций, API, webhook и `/metrics`. `/health/live` и `/health/ready` не ограничиваются: это проверки процесса.
- В production включаются CSP, HSTS и ограничивающая Permissions Policy.

## 17. Тестовая архитектура

`web`:

- unit tests утилит;
- component tests интерактивных виджетов;
- accessibility tests;
- E2E пользовательских сценариев.

`api`:

- unit tests services с in-memory fakes интерфейсов;
- repository integration tests с production-совместимым хранилищем;
- HTTP integration tests через backend app без открытия внешнего порта;
- contract tests request/response;
- adapter tests с записанными безопасными fixtures.

`worker`:

- claim/lease/retry;
- идемпотентность;
- восстановление зависших задач;
- fake clock для таймеров и расписаний.

Критичные E2E:

- вход/выход;
- настройка виджетов;
- CRUD рутин;
- таймер и доставка уведомления;
- подключение/отзыв Calendar;
- отказ одного внешнего провайдера.

## 18. Масштабирование без преждевременного усложнения

### Этап 1. MVP

- 1 web;
- 1 API;
- 1 worker;
- managed database;
- persistent job queue в основном хранилище;
- один сервер и compose-конфигурация.

### Этап 2. Рост нагрузки

- несколько API-контейнеров за proxy;
- несколько worker с lease;
- CDN для immutable frontend assets;
- отдельный shared cache/queue только при подтверждённой необходимости;
- общий cache handler, если web масштабируется горизонтально и используется server cache.

### Этап 3. Значительный рост

- отдельные worker pools по типам задач;
- managed queue;
- read replicas/увеличение tier хранилища;
- отдельный сервис новостей только если его нагрузка и цикл релиза действительно отличаются;
- orchestration platform только при недостаточности Compose.

Конкретные отложенные технологии перечислены в [TECHNOLOGIES.md](./TECHNOLOGIES.md). Распределённая архитектура не внедряется заранее.

## 19. Архитектурные ограничения

Запрещено:

- обращаться к базе данных из frontend;
- размещать бизнес-логику в UI components;
- создавать второй доменный backend внутри frontend-приложения;
- вызывать внешний API из браузера с секретным ключом;
- использовать модели Prisma и строки таблиц как API DTO;
- хранить неограниченные списки массивом или JSON внутри строки пользователя;
- запускать таймеры через долгоживущий `setTimeout` как источник истины;
- выполнять тяжёлую работу внутри webhook;
- добавлять отдельный cache/queue service, брокер сообщений или микросервис без измеримой причины;
- импортировать backend-код во frontend через workspace.

## 20. Принятые архитектурные решения

### ADR-001: модульный монолит

Выбран вместо микросервисов. Причина: небольшая команда, единый продукт, общая БД и необходимость быстрого развёртывания.

### ADR-002: same-origin через reverse proxy

Выбран для упрощения cookie-auth, CORS, CSRF и production URL.

### ADR-003: API и worker из одного backend-image

Выбрано для повторного использования доменной логики при независимом runtime-масштабировании.

### ADR-004: Persistent job queue в основном хранилище

Выбрана для уменьшения числа инфраструктурных компонентов. Скрывается за интерфейсом и может быть заменена внешней очередью.

### ADR-005: API contracts отдельно от DB models

Выбрано для безопасной эволюции схемы хранилища и предотвращения утечки внутренних полей.

## 21. Порядок создания архитектуры в коде

1. Подготовить frontend workspace в `apps/web`.
2. Настроить корневые workspaces и общие lint/type configs.
3. Добавить `packages/contracts`.
4. Создать backend app factory, health endpoints и error middleware.
5. Подключить Prisma Client, применить миграции и repository infrastructure.
6. Реализовать auth/session end-to-end.
7. Реализовать `widget_preferences` и базовый dashboard.
8. Добавить routines и timer.
9. Добавить `scheduled_jobs` и worker.
10. Подключать внешние интеграции по одной.
11. Добавить container builds, reverse proxy и production compose.
12. Настроить CI/CD, мониторинг и backup-проверки.

## 22. Источники

- [Технологии проекта](./TECHNOLOGIES.md)
- [Prisma ORM: PostgreSQL](https://www.prisma.io/docs/orm/overview/databases/postgresql)
- [Prisma Migrate](https://www.prisma.io/docs/orm/prisma-migrate)
- [PostgreSQL 18: Documentation](https://www.postgresql.org/docs/18/index.html)
- [Google Calendar API: Synchronize resources](https://developers.google.com/workspace/calendar/api/guides/sync)


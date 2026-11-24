# Технологии проекта

Версия документа: 1.1  
Статус: обязательный технологический стандарт  
Изменение 1.1: постоянное хранилище — PostgreSQL 18 и Prisma ORM 7.10.1.  
Связанные документы:

- [Техническое задание](./TECHNICAL_SPECIFICATION.md)
- [Архитектура](./architecture.md)
- [Дизайн-система](../Design.md)

## 1. Назначение документа

Этот файл является единым источником истины для технологического стека, версий платформ, библиотек, инструментов разработки и инфраструктуры проекта.

Замена обязательной технологии, перенос ответственности между frontend и backend либо добавление альтернативного framework/хранилища требует отдельного архитектурного решения и обновления этого документа.

Фактически установленные версии фиксируются в `package.json` workspace-пакетов и `package-lock.json`. При расхождении lock-файл имеет приоритет для воспроизводимой сборки.

## 2. Обязательный основной стек

### Frontend

- React 19.3.1.
- Next.js 16.4.2 с App Router.
- TypeScript 6.0.3 в strict-режиме.
- Sass/SCSS через пакет `sass` 1.105.2.
- SCSS Modules для локальных стилей компонентов.
- CSS custom properties для runtime-переключения светлой и тёмной тем.

### Backend

- Node.js 24 LTS.
- Express 5.3.0.
- TypeScript 6.0.3 в strict-режиме.
- REST API с префиксом и версионированием `/api/v1`.
- Отдельный worker-процесс из той же кодовой базы, что и API.

### Хранение данных

- PostgreSQL 18 как основная и обязательная база данных для локального, CI и self-hosted окружения.
- Prisma ORM 7.10.1. Пакеты `prisma`, `@prisma/client` и `@prisma/adapter-pg` фиксируются одной версией.
- `pg` 8.23.1 — драйвер node-postgres. Пул соединений создаёт `@prisma/adapter-pg`, а Prisma Client работает через этот адаптер.
- Managed PostgreSQL 18 — рекомендуемый production-вариант. В production база не ставится на тот же сервер, что и приложение, если доступен managed-сервис.
- Prisma ORM 8 не используется: в реестре npm линия 8 остаётся release candidate и не входит в обязательный стек до стабильного релиза.
- Redis не требуется для MVP и может быть добавлен только для подтверждённых задач распределённого кэша, rate limiting, блокировок или очередей.

## 3. Границы ответственности технологий

- Next.js отвечает за маршрутизацию интерфейса, SSR, Server Components, Client Components и доставку frontend assets.
- Директива `'use client'` размещается как можно ниже по дереву компонентов.
- React используется для интерактивных UI-компонентов и клиентского состояния.
- Express является единственной точкой входа доменного REST API, OAuth callback и webhook.
- Backend владеет бизнес-логикой, секретами, внешними интеграциями и доступом к базе данных.
- Next.js Route Handlers не используются как второй доменный backend.
- Frontend не подключается к PostgreSQL и не импортирует Prisma Client.
- Worker выполняет фоновые, периодические и отложенные задачи независимо от HTTP API.
- Общие API DTO и runtime-схемы размещаются в `packages/contracts`; модели Prisma во frontend не экспортируются.

## 4. Frontend-библиотеки

### Интерфейс и взаимодействия

- `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` — доступная сортировка и изменение порядка виджетов.
- `react-hook-form` — управление состоянием форм.
- `@hookform/resolvers` — подключение runtime-схем к формам.
- `lucide-react` — единый набор интерфейсных иконок.
- `clsx` — безопасная композиция CSS-классов.

### Дата и время

- `date-fns` — операции с датами.
- `@date-fns/tz` — работа с выбранным пользователем часовым поясом.

### Стили

- Компонентные стили размещаются в `*.module.scss`.
- Глобальный SCSS применяется только для reset, typography, themes и design tokens.
- Современный `@use` используется вместо устаревшего `@import`.
- Inline styles допускаются только для значений, вычисляемых во время выполнения.

### Погода и анимация

- Источник для MVP — Open-Meteo либо другой провайдер с текущей погодой, почасовым прогносом и weather code.
- Доступ к провайдеру выполняется только через серверный adapter.
- Погодная сцена реализуется на CSS, Canvas или Lottie без блокировки основного потока.
- При `prefers-reduced-motion: reduce` показывается статичная иллюстрация.

### Изображения

- `sharp` используется production-сборкой для серверной оптимизации изображений.

## 5. Backend-библиотеки

### HTTP и безопасность

- `express` — HTTP API.
- `helmet` — защитные HTTP-заголовки.
- `cors` — строгий allowlist при разных origin.
- `compression` — сжатие HTTP-ответов.
- `cookie-parser` — обработка cookie.
- `express-rate-limit` — rate limiting.
- `zod` — runtime-валидация конфигурации и API-данных.
- `dotenv` — загрузка локального окружения.

### Авторизация и интеграции

- `openid-client` — OpenID Connect и Google OAuth.
- `googleapis` — Google Calendar API.
- `rss-parser` — RSS/Atom-источники AI-новостей.
- `web-push` — браузерные push-уведомления.
- Telegram Bot API вызывается через стандартный HTTP-клиент Node.js без обязательной framework-обёртки.
- Weather API подключается через собственный provider adapter.

### Наблюдаемость

- `pino` — структурированные application logs.
- `pino-http` — HTTP access logs.
- `@prometheus-io/client` — application metrics.

## 6. API-контракты и типизация

- `packages/contracts` содержит сериализуемые DTO, runtime-схемы и типы, выведенные из схем.
- `zod` является базовой библиотекой runtime-схем.
- Контракты не зависят от React, Express или Prisma.
- В API не передаются модели Prisma, строки таблиц и секретные поля интеграций.
- TypeScript `any` допускается только с документированным обоснованием.

## 7. Фоновые задачи и кэш

На MVP persistent job queue хранится в PostgreSQL:

- worker забирает задачу одним условным `UPDATE` с `FOR UPDATE SKIP LOCKED`;
- lease защищает от зависшей обработки;
- unique idempotency key предотвращает дубли;
- worker удаляет завершённые записи по сроку `deleteAt`;
- периодические задачи используют распределённый lock в той же базе.

Доступ к очереди скрывается интерфейсом `JobQueue`. При подтверждённом росте нагрузки реализацию можно заменить Redis-backed или managed queue без изменения доменных сервисов.

Погода, новости и синхронизированные события используют серверный кэш. PostgreSQL остаётся источником истины для persistent данных. У PostgreSQL нет TTL-индексов: сроки хранения исполняет worker.

## 8. Monorepo и package management

- npm 11.17.0.
- npm workspaces для `apps/*` и `packages/*`.
- Один корневой `package-lock.json`.
- `concurrently` запускает локальные процессы параллельно.
- `rimraf` очищает build/test artifacts кроссплатформенно.
- `apps/web` — frontend workspace.
- `apps/api` — API и worker workspace.
- `packages/contracts` — API-контракты.
- `packages/config` — общие настройки TypeScript и ESLint.
- Дополнительный build orchestrator не используется на MVP.

Turborepo или аналог допускается только при заметном росте количества пакетов и времени CI.

## 9. Качество кода и тестирование

### Статический анализ и форматирование

- ESLint 10.
- `eslint-config-next` для frontend-правил.
- `typescript-eslint` для TypeScript.
- Prettier 3.9.10.

### Тестирование

- Vitest 5.0.5 — unit, component и integration tests. Проекты: `unit`, `component`, `integration`, `api`, `contracts`.
- `@vitejs/plugin-react` 5.2.0 — JSX/TSX-трансформация тестов React-компонентов.
- `@vitest/coverage-v8` 5.0.5 — покрытие.
- `@testing-library/react` 16.3.3 — component-тесты React-компонентов.
- `@testing-library/user-event` 14.6.8 — пользовательские действия в component и integration тестах.
- `@testing-library/dom` 10.4.2 — DOM-утилиты Testing Library.
- `@testing-library/jest-dom` 7.0.1 — DOM-матчеры для Vitest (`toBeInTheDocument`, `toBeDisabled`).
- jsdom 30.1.3 — DOM-окружение component и integration tests.
- Supertest 7.3.1 — HTTP integration tests Express-приложения.
- Playwright 1.64.1 и `@playwright/test` 1.64.1 — end-to-end тесты критичных пользовательских сценариев.
- Браузер: Chromium. Проекты Playwright: `chromium` (Desktop Chrome) и `mobile-chromium` (Pixel 7).
- Спеки лежат в `apps/web/e2e/*.spec.ts` и проверяют вход, юридические страницы, навигацию desktop/mobile, профиль (тема и часовой пояс), рутины и интеграции.

Имена файлов:

- `*.unit.test.ts` — чистая логика без DOM;
- `*.component.test.tsx` — изолированный компонент;
- `*.integration.test.tsx` — сборка нескольких компонентов существующего экрана;
- `apps/web/e2e/*.spec.ts` — Playwright E2E.

Команды из корня `my-app`: `npm test`, `npm run test:unit`, `npm run test:component`, `npm run test:integration`, `npm run test:coverage`, `npm run test:e2e`, `npm run test:e2e:install`.

Integration tests хранилища выполняются с реальным PostgreSQL 18. Prisma Client в этих тестах не подменяется моком. Перед прогоном схема накатывается командой `prisma migrate deploy`. HTTP-тесты API на Supertest добавляются вместе с backend-модулями.

## 10. Сборка и запуск

- `tsx` используется для локального запуска TypeScript backend и worker в watch mode.
- `tsc` компилирует API и contracts.
- Next.js выполняет frontend build.
- Production frontend использует `output: "standalone"`.
- Один backend image запускается двумя командами: API и worker.
- Environment values передаются при запуске и не встраиваются в image без необходимости.

## 11. Контейнеризация и production-инфраструктура

### Контейнеры

- Docker Engine.
- Docker Compose для локальной инфраструктуры и первого production-развёртывания.
- Node.js 24 Alpine как базовый runtime image.
- Multi-stage Dockerfiles для frontend и backend.
- Контейнеры запускаются от непривилегированного пользователя.

### Сеть

- nginx 1.29 Alpine используется как reverse proxy в текущей конфигурации.
- Допустима замена nginx на Caddy отдельным инфраструктурным решением.
- Reverse proxy завершает TLS, ограничивает размер запроса и маршрутизирует `/api/v1/*` в backend.
- Frontend, API и worker работают как отдельные процессы/контейнеры.

### Хостинг

Стартовая production-конфигурация:

- Linux VPS;
- один frontend-контейнер;
- один API-контейнер;
- один worker-контейнер;
- managed PostgreSQL 18;
- Docker Compose.

Kubernetes не используется на MVP. Он рассматривается только после появления операционной необходимости, которую нельзя закрыть Compose или managed platform.

## 12. CI/CD

Pipeline использует:

- `npm ci` для воспроизводимой установки;
- ESLint и TypeScript typecheck;
- Vitest и Playwright;
- multi-stage Docker builds;
- dependency/security scan;
- versioned images с immutable tag по commit SHA;
- `prisma generate` и `prisma migrate deploy`;
- health checks и rollback.

## 13. Web Platform API

Приложение использует:

- Geolocation API;
- Notifications API;
- Service Worker API;
- Web Push;
- `prefers-reduced-motion`;
- CSS container queries;
- CSS custom properties;
- browser storage только для несекретных локальных предпочтений.

OAuth-токены, refresh tokens и server session не хранятся в `localStorage`.

## 14. Неиспользуемые и отложенные технологии

Не входят в целевой стек:

- Tailwind CSS;
- Prisma ORM 8 до стабильного релиза;
- Drizzle;
- GraphQL;
- Kubernetes на MVP;
- микросервисная архитектура;
- отдельный event bus;
- Redis без измеримой необходимости;
- runtime CSS-in-JS.

## 15. Открытые технологические решения

- Конкретный провайдер, тариф и регион managed PostgreSQL 18.
- Нужен ли внешний пулер соединений после появления реальной нагрузки. На MVP пул держит `@prisma/adapter-pg`.
- Нужен ли Redis после появления реальной нагрузки.
- Production-провайдер Linux/VPS или managed container platform.
- Провайдер Weather API после проверки лимитов и коммерческих условий.
- Коммерческий News API как резерв RSS/Atom.
- Secret storage и система централизованного мониторинга production.

## 16. Правила обновления стека

Перед обновлением major-версии необходимо:

1. Проверить release notes и migration guide.
2. Обновить отдельной веткой.
3. Выполнить lint, typecheck, unit, integration и E2E tests.
4. Проверить production build обоих приложений.
5. Выполнить dependency audit.
6. Обновить этот документ и lock-файл.

## 17. Документационные источники

- [Next.js: Self-Hosting](https://nextjs.org/docs/app/guides/self-hosting)
- [Next.js: Sass](https://nextjs.org/docs/app/guides/sass)
- [Express: Production Best Practices](https://expressjs.com/en/advanced/best-practice-performance.html)
- [Express: Behind Proxies](https://expressjs.com/en/guide/behind-proxies.html)
- [Prisma ORM: PostgreSQL](https://www.prisma.io/docs/orm/overview/databases/postgresql)
- [Prisma Migrate](https://www.prisma.io/docs/orm/prisma-migrate)
- [PostgreSQL 18: Documentation](https://www.postgresql.org/docs/18/index.html)
- [Google Calendar API: Synchronize resources](https://developers.google.com/workspace/calendar/api/guides/sync)


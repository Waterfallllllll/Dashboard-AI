## 2026-10-23 — Основа frontend

- Реализованы дизайн-токены, светлая/тёмная темы с системным режимом, адаптивный app shell и маршруты MVP.
- Добавлены layouts, базовые route pages, доступная desktop/mobile-навигация, переключатель темы и иконка приложения в `apps/web/src`.
- Из `apps/web/tsconfig.json` удалён устаревший `baseUrl`; alias `@/*` сохранён через `paths`.
- Проверки: ESLint, TypeScript, Prettier и production build пройдены; UI проверен в браузере на desktop и 320 px.
- Новые переменные окружения не добавлялись.

## 2026-10-23 — Frontend-страницы входа, профиля, интеграций и документов

- Реализованы страницы `/login`, `/privacy`, `/terms`, `/settings/profile`, `/settings/integrations` и `/settings/routines`.
- Добавлены feature-компоненты auth, profile, integrations и routines: split-layout входа, юридические документы, настройки профиля, карточки интеграций, поиск и фильтры рутин.
- Состояния OAuth, выход и удаление аккаунта, подключение интеграций и создание рутин показаны как недоступные до backend.
- Проверки: ESLint, TypeScript, Prettier и production build пройдены; UI проверен в браузере на desktop и 320 px; Lighthouse Accessibility/Best Practices/SEO — 100.
- Новые переменные окружения не добавлялись.

## 2026-10-26 — ESLint-правила архитектурных границ

- Добавлен `@dashboard/config/eslint/boundaries`: запрет импортов web↔api, MongoDB/Express во frontend и contracts, UI-пакетов в api/contracts, внутренностей features не через `index.ts`, Next.js Route Handlers как доменного backend, browser storage в `features/auth`, обратных импортов слоёв api.
- В `eslint/base` включены `consistent-type-imports` и `no-import-type-side-effects` под `verbatimModuleSyntax`.
- Запрещённый стек (Tailwind, CSS-in-JS, Prisma/Drizzle, GraphQL, PostgreSQL) закрыт через `no-restricted-imports` без новых пакетов.
- Изменены: `packages/config/eslint/boundaries.mjs`, `packages/config/eslint/base.mjs`, `packages/config/package.json`, `eslint.config.mjs`.
- Проверки: `npm run lint` проходит; `npm run build --workspace @dashboard/web` проходит. Корневой `npm run build` падает на пустом `@dashboard/contracts` (`tsc`: нет `src/**/*.ts`) — состояние до этой задачи.
- Новые переменные окружения не добавлялись.

## 2026-10-28 — Unit, component и integration тесты существующего frontend

- Добавлены тесты для навигации, темы, входа, профиля, интеграций, рутин, юридических документов и оболочек layout.
- Чистая логика вынесена в model-модули: `parseLoginStatus`, `filterRoutines`, `parseStoredPreferences`, theme preference, navigation paths.
- Установлены `@testing-library/jest-dom` 7.0.1, `@vitejs/plugin-react` 5.2.0; jsdom вынесен в корневые devDependencies для Vitest.
- Команды: `npm test`, `npm run test:unit`, `npm run test:component`, `npm run test:integration`.
- Обновлён `@docs/TECHNOLOGIES.md`.
- Проверки: 33 теста зелёные; `npm run lint` и typecheck web проходят; `npm run build --workspace @dashboard/web` проходит. Корневой `npm run build` по-прежнему падает на пустом `@dashboard/contracts`.
- Новые переменные окружения не добавлялись.

## 2026-10-29 — Playwright E2E критичных сценариев

- Добавлены E2E в `apps/web/e2e`: публичный вход и юридические страницы, редирект на дашборд, desktop/mobile навигация, сохранение темы и часового пояса, фильтр рутин, блокировка интеграций до API.
- Пакеты: `@playwright/test` 1.64.1, `playwright` 1.64.1; браузер Chromium. Команды: `npm run test:e2e`, `npm run test:e2e:install`.
- Обновлены `@docs/TECHNOLOGIES.md` и `.cursor/rules/verification.mdc`.
- Проверки: Playwright 18 passed / 2 skipped; Vitest 33 passed; `npm run lint` проходит; `npm run build --workspace @dashboard/web` проходит.
- Новые переменные окружения не добавлялись.

## 2026-10-31 — Адаптивная сетка дашборда и независимые состояния виджетов

- Собрана Bento-сетка на `/dashboard`: 1 / 6 / 12 колонок по ширине контейнера, размеры compact / standard / wide / full, container queries внутри карточки.
- Добавлен `features/dashboard`: оболочка виджета с заголовком, меню, обновлением внешних источников и локальной error boundary.
- Независимые состояния: loading (skeleton), success, empty, permission-required, disconnected, stale с сохранёнными данными, error с «Повторить». Пустой дашборд ведёт на `/settings/widgets`.
- Содержимое виджетов остаётся каркасом до следующего этапа; демо-состояния не блокируют соседние карточки.
- Проверки: Vitest 51 passed; Playwright 23 passed / 3 skipped; `npm run lint` проходит; `npm run build --workspace @dashboard/web` проходит. UI проверен в браузере на desktop и 320 px.
- Новые переменные окружения не добавлялись.

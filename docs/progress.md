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

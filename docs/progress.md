## 2026-10-23 — Основа frontend

- Реализованы дизайн-токены, светлая/тёмная темы с системным режимом, адаптивный app shell и маршруты MVP.
- Добавлены layouts, базовые route pages, доступная desktop/mobile-навигация, переключатель темы и иконка приложения в `apps/web/src`.
- Из `apps/web/tsconfig.json` удалён устаревший `baseUrl`; alias `@/*` сохранён через `paths`.
- Проверки: ESLint, TypeScript, Prettier и production build пройдены; UI проверен в браузере на desktop и 320 px.
- Новые переменные окружения не добавлялись.

# Evergreen Dashboard

Monorepo персонального информационного дашборда.

## Состав

- `apps/web` — Next.js, React, TypeScript и SCSS.
- `apps/api` — Express API и worker на Node.js.
- `packages/contracts` — общие runtime-схемы и API DTO.
- `packages/config` — общие TypeScript и ESLint настройки.
- `infra` — Docker Compose, Dockerfiles и reverse proxy.

Исходный код намеренно не добавлен. Каталоги подготовлены с `.gitkeep`.

## Требования

- Node.js 24 LTS.
- npm 11+.
- Docker с Compose plugin.

## Подготовка окружения

1. Установить зависимости: `npm install`.
2. Создать локальный `.env` из `.env.example`.
3. Запустить MongoDB: `npm run infra:up`.

Команды разработки станут доступны после добавления entrypoint-файлов приложений.

## Документация

- [Техническое задание](./TECHNICAL_SPECIFICATION.md)
- [Архитектура](./architecture.md)
- [Дизайн-система](./Design.md)

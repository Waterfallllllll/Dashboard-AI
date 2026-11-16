# Evergreen Dashboard

Monorepo персонального информационного дашборда.

## Состав

- `apps/web` — frontend-приложение.
- `apps/api` — backend API и worker.
- `packages/contracts` — общие runtime-схемы и API DTO.
- `packages/config` — общие настройки разработки.
- `infra` — конфигурация развёртывания.

## Требования

Стек, версии и системные требования зафиксированы в [документе технологий](./docs/TECHNOLOGIES.md).

## Подготовка окружения

1. Установить зависимости командой из документа технологий.
2. Создать локальный `.env` из `.env.example`.
3. Запустить локальную инфраструктуру корневой командой проекта.

## Документация

- [Техническое задание](./docs/TECHNICAL_SPECIFICATION.md)
- [Архитектура](./docs/architecture.md)
- [Технологии](./docs/TECHNOLOGIES.md)
- [Дизайн-система](./Design.md)

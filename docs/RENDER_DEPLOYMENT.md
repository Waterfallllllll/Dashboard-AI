# Развёртывание в Render

Render Blueprint из `render.yaml` создаёт четыре ресурса в регионе Frankfurt:

- публичный Next.js web service;
- приватный Express API;
- background worker;
- PostgreSQL 18, доступный только через private network.

Браузер обращается к `/api/v1/*` на домене web. Next.js проксирует запросы к
приватному API, поэтому API не получает публичный адрес.

## Стоимость пробного запуска

В Blueprint выбраны минимальные планы:

- web — Free, засыпает через 15 минут без входящих запросов;
- PostgreSQL — Free, без резервных копий и с удалением через 30 дней;
- private API — минимальный платный план;
- worker — минимальный платный план.

Render показывает итоговую стоимость до создания ресурсов. Для постоянной
production-версии web и PostgreSQL нужно перевести на платные планы до окончания
30-дневного срока базы.

## Подготовка

1. Отправьте ветку с `render.yaml` в GitHub.
2. Подготовьте Google OAuth Client типа Web application.
3. Решите, какой origin будет публичным:
   - адрес Render: `https://evergreen-dashboard-web.onrender.com`;
   - либо заранее выбранный собственный домен.

Если имя web service уже занято и Render выдаёт другой адрес, после создания
ресурсов обновите `APP_ORIGIN` и `GOOGLE_REDIRECT_URI`, затем повторно разверните
API и worker.

## Создание Blueprint

1. В Render откройте **New → Blueprint**.
2. Подключите GitHub-репозиторий Dashboard.
3. Render найдёт корневой `render.yaml`.
4. До применения Blueprint заполните запрошенные значения:
   - `APP_ORIGIN` — публичный HTTPS origin без завершающего `/`;
   - `GOOGLE_CLIENT_ID` — идентификатор Google OAuth Client;
   - `GOOGLE_CLIENT_SECRET` — секрет Google OAuth Client;
   - `GOOGLE_REDIRECT_URI` — `<APP_ORIGIN>/api/v1/auth/google/callback`.
5. Проверьте выбранные планы и подтвердите создание ресурсов.

`SESSION_SECRET` и `DATA_ENCRYPTION_KEY` Render создаёт автоматически. Не
копируйте локальный `.env` в Dashboard и не добавляйте его в Git.

Перед каждым запуском API и worker выполняют `prisma migrate deploy`. Оба
процесса используют одну private connection string Render PostgreSQL.

## Настройка Google Cloud

В OAuth Client добавьте:

- Authorized JavaScript origin: значение `APP_ORIGIN`;
- Authorized redirect URI входа:
  `<APP_ORIGIN>/api/v1/auth/google/callback`;
- Authorized redirect URI календаря:
  `<APP_ORIGIN>/api/v1/integrations/google/callback`.

Пока OAuth consent screen находится в режиме Testing, добавьте нужные Google
аккаунты в список test users.

## Проверка после запуска

1. Откройте `<APP_ORIGIN>/login`.
2. Убедитесь, что запрос `/api/v1/auth/session` возвращает JSON, а не сетевую
   ошибку.
3. Выполните вход через Google и проверьте возврат на `/dashboard`.
4. В логах API проверьте запуск HTTP-сервера без ошибок конфигурации.
5. В логах worker проверьте сообщения `Worker запущен` и успешные циклы очереди.
6. В Events API и worker проверьте успешное выполнение pre-deploy migration.

## Собственный домен

После добавления домена к web service:

1. дождитесь выпуска TLS-сертификата Render;
2. замените `APP_ORIGIN` в environment group;
3. замените `GOOGLE_REDIRECT_URI`;
4. обновите оба redirect URI и JavaScript origin в Google Cloud;
5. повторно разверните web, API и worker.

## Необязательные интеграции

Telegram и Web Push не нужны для первого запуска. Позже их переменные можно
добавить в environment group backend:

- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`;
- `TELEGRAM_WEBHOOK_SECRET`, `TELEGRAM_WEBHOOK_URL`;
- `GOOGLE_CALENDAR_WEBHOOK_TOKEN`, `GOOGLE_CALENDAR_WEBHOOK_URL`;
- `WEB_PUSH_SUBJECT`, `WEB_PUSH_PUBLIC_KEY`, `WEB_PUSH_PRIVATE_KEY`.

Для Web Push то же публичное значение дополнительно задаётся web service как
`NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY`, после чего web нужно пересобрать.

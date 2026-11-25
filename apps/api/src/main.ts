import "./load-environment.js";
import { createServer } from "node:http";

import { createBackend } from "./app/create-backend.js";
import { createApp } from "./app/create-app.js";
import { installShutdown } from "./app/shutdown.js";
import { pingDatabase } from "./infrastructure/db/prisma-client.js";

try {
  const backend = await createBackend();
  const app = createApp({
    config: backend.runtime.config,
    logger: backend.logger,
    authService: backend.authService,
    usersService: backend.usersService,
    widgetsService: backend.personal.widgets,
    routinesService: backend.personal.routines,
    timersService: backend.personal.timers,
    dashboardService: backend.external.dashboard,
    weatherService: backend.external.weather,
    newsService: backend.external.news,
    calendarService: backend.external.calendar,
    integrationsService: backend.external.integrations,
    notificationsService: backend.notificationsService,
    webhookService: backend.webhookService,
    metrics: backend.metrics,
    readyCheck: () => pingDatabase(backend.prisma)
  });
  const server = createServer(app);
  server.listen(backend.runtime.config.port, () => {
    backend.logger.info({ port: backend.runtime.config.port }, "API слушает порт");
    void backend.registerTelegramWebhook().catch(() => {
      backend.logger.warn({}, "Webhook Telegram не зарегистрирован");
    });
  });
  installShutdown({
    server,
    logger: backend.logger,
    closeStorage: backend.close
  });
} catch (error) {
  const message = error instanceof Error ? error.message : "API не запустился";
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

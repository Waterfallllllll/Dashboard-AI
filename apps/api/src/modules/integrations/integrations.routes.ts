import { Router } from "express";

import type { AppConfig } from "../../config/env.js";
import { requireSession } from "../../middleware/require-session.js";
import { createRateLimiter } from "../../middleware/rate-limit.js";
import type { CalendarService } from "../calendar/calendar.service.js";
import { createIntegrationsController } from "./integrations.controller.js";
import type { IntegrationsService } from "./integrations.service.js";

export function createIntegrationsRouter(
  integrations: IntegrationsService,
  calendar: CalendarService,
  config: AppConfig
) {
  const router = Router();
  const controller = createIntegrationsController(integrations, calendar, config);
  const linkLimit = createRateLimiter(config.authRateLimit, "linkRateLimit");
  router.get("/integrations", requireSession, controller.list);
  router.post("/integrations/google/connect", linkLimit, requireSession, controller.connectGoogle);
  router.get("/integrations/google/callback", linkLimit, controller.googleCallback);
  router.delete("/integrations/google", requireSession, controller.disconnectGoogle);
  router.post("/integrations/telegram/link", linkLimit, requireSession, controller.linkTelegram);
  router.delete("/integrations/telegram", requireSession, controller.disconnectTelegram);
  return router;
}

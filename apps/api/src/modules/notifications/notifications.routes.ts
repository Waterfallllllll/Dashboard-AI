import { Router } from "express";

import { requireSession } from "../../middleware/require-session.js";
import { createNotificationsController } from "./notifications.controller.js";
import type { NotificationsService } from "./notifications.service.js";

export function createNotificationsRouter(notifications: NotificationsService) {
  const router = Router();
  const controller = createNotificationsController(notifications);
  router.get("/notifications/preferences", requireSession, controller.preferences);
  router.patch("/notifications/preferences", requireSession, controller.replacePreferences);
  router.get("/notifications", requireSession, controller.list);
  router.post("/push/subscriptions", requireSession, controller.savePush);
  router.delete("/push/subscriptions/:id", requireSession, controller.revokePush);
  return router;
}

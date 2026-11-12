import { Router } from "express";

import { requireSession } from "../../middleware/require-session.js";
import { createWidgetsController } from "./widgets.controller.js";
import type { WidgetsService } from "./widgets.service.js";

export function createWidgetsRouter(widgets: WidgetsService) {
  const router = Router();
  const controller = createWidgetsController(widgets);
  router.get("/widgets/preferences", requireSession, controller.get);
  router.patch("/widgets/preferences", requireSession, controller.update);
  return router;
}

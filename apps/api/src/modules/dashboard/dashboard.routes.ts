import { Router } from "express";

import { requireSession } from "../../middleware/require-session.js";
import { createDashboardController } from "./dashboard.controller.js";
import type { DashboardService } from "./dashboard.service.js";

export function createDashboardRouter(dashboard: DashboardService) {
  const router = Router();
  const controller = createDashboardController(dashboard);
  router.get("/dashboard", requireSession, controller.get);
  return router;
}

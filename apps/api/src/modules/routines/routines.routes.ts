import { Router } from "express";

import { requireSession } from "../../middleware/require-session.js";
import { createRoutinesController } from "./routines.controller.js";
import type { RoutinesService } from "./routines.service.js";

export function createRoutinesRouter(routines: RoutinesService) {
  const router = Router();
  const controller = createRoutinesController(routines);
  router.get("/routines", requireSession, controller.listDay);
  router.get("/routine-rules", requireSession, controller.listRules);
  router.post("/routine-rules", requireSession, controller.create);
  router.patch("/routine-rules/:id", requireSession, controller.update);
  router.delete("/routine-rules/:id", requireSession, controller.remove);
  router.post("/routine-rules/:id/restore", requireSession, controller.restore);
  router.patch("/routine-occurrences/:id", requireSession, controller.updateOccurrence);
  return router;
}

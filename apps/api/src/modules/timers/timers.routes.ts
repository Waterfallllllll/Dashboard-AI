import { Router } from "express";

import { requireSession } from "../../middleware/require-session.js";
import { createTimersController } from "./timers.controller.js";
import type { TimersService } from "./timers.service.js";

export function createTimersRouter(timers: TimersService) {
  const router = Router();
  const controller = createTimersController(timers);
  router.get("/timers/current", requireSession, controller.current);
  router.get("/timers", requireSession, controller.history);
  router.post("/timers", requireSession, controller.start);
  router.patch("/timers/:id", requireSession, controller.update);
  return router;
}

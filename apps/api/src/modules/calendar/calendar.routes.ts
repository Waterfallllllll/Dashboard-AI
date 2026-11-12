import { Router } from "express";

import { requireSession } from "../../middleware/require-session.js";
import { createCalendarController } from "./calendar.controller.js";
import type { CalendarService } from "./calendar.service.js";

export function createCalendarRouter(calendar: CalendarService) {
  const router = Router();
  const controller = createCalendarController(calendar);
  router.get("/calendar/events", requireSession, controller.list);
  router.post("/calendar/sync", requireSession, controller.sync);
  return router;
}

import { Router } from "express";

import { requireSession } from "../../middleware/require-session.js";
import { createNewsController } from "./news.controller.js";
import type { NewsService } from "./news.service.js";

export function createNewsRouter(news: NewsService) {
  const router = Router();
  const controller = createNewsController(news);
  router.get("/news", requireSession, controller.get);
  return router;
}

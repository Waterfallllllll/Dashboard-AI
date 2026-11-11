import { Router } from "express";

import { createRateLimiter } from "../../middleware/rate-limit.js";
import { requireSession } from "../../middleware/require-session.js";
import type { AppConfig } from "../../config/env.js";
import type { Logger } from "../../infrastructure/logging/logger.js";
import { createAuthController } from "./auth.controller.js";
import type { AuthService } from "./auth.service.js";

export function createAuthRouter(deps: {
  authService: AuthService;
  config: AppConfig;
  logger: Logger;
}) {
  const router = Router();
  const controller = createAuthController(deps.authService, deps.config, deps.logger);
  router.use(createRateLimiter(deps.config.authRateLimit));
  router.get("/google", controller.start);
  router.get("/google/callback", controller.callback);
  router.get("/session", requireSession, controller.current);
  router.post("/logout", controller.logout);
  return router;
}

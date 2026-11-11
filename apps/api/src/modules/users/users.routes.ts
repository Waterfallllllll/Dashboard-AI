import { Router } from "express";

import { requireSession } from "../../middleware/require-session.js";
import { createUsersController } from "./users.controller.js";
import type { UsersService } from "./users.service.js";

export function createUsersRouter(users: UsersService) {
  const router = Router();
  const controller = createUsersController(users);
  router.get("/profile", requireSession, controller.get);
  router.patch("/profile", requireSession, controller.update);
  router.delete("/account", requireSession, controller.remove);
  return router;
}

import { API_ERROR_CODES } from "@dashboard/contracts";
import type { Request } from "express";

import { ApiError } from "../errors/api-error.js";
import type { Actor } from "../../modules/auth/auth.types.js";

export type Viewer = Actor & {
  readonly timezone: string;
  readonly timeFormat: "12" | "24";
};

export function requireActor(req: Request): Actor {
  const actor = req.session?.actor;

  if (!actor) {
    throw new ApiError({ code: API_ERROR_CODES.unauthenticated });
  }

  return actor;
}

export function requireViewer(req: Request): Viewer {
  const session = req.session;

  if (!session) {
    throw new ApiError({ code: API_ERROR_CODES.unauthenticated });
  }

  return {
    userId: session.actor.userId,
    sessionId: session.actor.sessionId,
    timezone: session.user.timezone,
    timeFormat: session.user.timeFormat
  };
}

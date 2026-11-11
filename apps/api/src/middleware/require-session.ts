import { API_ERROR_CODES } from "@dashboard/contracts";
import type { NextFunction, Request, Response } from "express";

import { ApiError } from "../shared/errors/api-error.js";
import { asyncHandler } from "../shared/http/async-handler.js";
import type { AuthService } from "../modules/auth/auth.service.js";
import { readSessionCookie } from "../modules/auth/session-cookie.js";

export function loadSession(auth: AuthService) {
  return asyncHandler(async (req, _res, next) => {
    const token = readSessionCookie(req);

    if (!token) {
      next();
      return;
    }

    const current = await auth.authenticate(token);

    if (current) {
      req.session = current;
    }

    next();
  });
}

export function requireSession(req: Request, _res: Response, next: NextFunction): void {
  if (!req.session) {
    next(new ApiError({ code: API_ERROR_CODES.unauthenticated }));
    return;
  }

  next();
}

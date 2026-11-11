import { API_ERROR_CODES, CSRF_HEADER } from "@dashboard/contracts";
import type { NextFunction, Request, Response } from "express";

import type { AppConfig } from "../config/env.js";
import { ApiError } from "../shared/errors/api-error.js";
import { csrfTokenFor, csrfTokensMatch } from "../modules/auth/csrf.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function requireCsrf(config: AppConfig) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (SAFE_METHODS.has(req.method)) {
      next();
      return;
    }

    if (req.header("origin") !== config.appOrigin) {
      next(new ApiError({ code: API_ERROR_CODES.forbidden }));
      return;
    }

    const current = req.session;

    if (!current) {
      next();
      return;
    }

    const header = req.header(CSRF_HEADER);

    if (
      typeof header !== "string" ||
      !csrfTokensMatch(header, csrfTokenFor(current.sessionToken, config.sessionSecret))
    ) {
      next(new ApiError({ code: API_ERROR_CODES.forbidden }));
      return;
    }

    next();
  };
}

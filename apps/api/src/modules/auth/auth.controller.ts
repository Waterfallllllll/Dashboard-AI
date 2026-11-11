import {
  API_ERROR_CODES,
  sessionResponseSchema,
  signOutResponseSchema
} from "@dashboard/contracts";
import type { Request, Response } from "express";
import type { Logger } from "pino";

import type { AppConfig } from "../../config/env.js";
import { ApiError } from "../../shared/errors/api-error.js";
import { asyncHandler } from "../../shared/http/async-handler.js";
import { requestIdFrom } from "../../shared/http/request-id.js";
import { sendParsed } from "../../shared/http/respond.js";
import { OAuthCallbackError } from "./auth.types.js";
import { csrfTokenFor } from "./csrf.js";
import { queryParams } from "./oauth-request.js";
import { clearSessionCookie, setSessionCookie } from "./session-cookie.js";
import type { AuthService } from "./auth.service.js";
import { profileDto } from "../users/user-profile.js";

export function createAuthController(auth: AuthService, config: AppConfig, logger: Logger) {
  return {
    start: asyncHandler(async (_req, res) => {
      try {
        const url = await auth.beginLogin();
        redirect(res, url);
      } catch (error) {
        logFailure(logger, error);
        redirect(res, loginUrl(config.appOrigin, "error"));
      }
    }),
    callback: asyncHandler(async (req, res) => {
      try {
        const login = await auth.completeLogin(queryParams(requestQuery(req)));
        setSessionCookie(res, login.token, config.sessionTtlMs);
        redirect(res, `${config.appOrigin}/dashboard`);
      } catch (error) {
        if (!(error instanceof OAuthCallbackError)) {
          logFailure(logger, error);
        }

        clearSessionCookie(res);
        const status = error instanceof OAuthCallbackError ? error.status : "error";
        redirect(res, loginUrl(config.appOrigin, status));
      }
    }),
    current: asyncHandler(async (req, res) => {
      const current = req.session;

      if (!current) {
        throw new ApiError({ code: API_ERROR_CODES.unauthenticated });
      }

      sendParsed(res, sessionResponseSchema, 200, {
        data: {
          user: profileDto(current.user),
          expiresAt: current.expiresAt.toISOString(),
          csrfToken: csrfTokenFor(current.sessionToken, config.sessionSecret)
        },
        meta: { requestId: requestIdFrom(req) }
      });
    }),
    logout: asyncHandler(async (req, res) => {
      if (req.session) {
        await auth.revoke(req.session.actor.sessionId);
      }

      clearSessionCookie(res);
      sendParsed(res, signOutResponseSchema, 200, {
        data: { signedOut: true },
        meta: { requestId: requestIdFrom(req) }
      });
    })
  };
}

function requestQuery(req: Request): Record<string, unknown> {
  const query: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(req.query)) {
    query[key] = value;
  }

  return query;
}

function redirect(res: Response, url: string): void {
  res.setHeader("Cache-Control", "no-store");
  res.redirect(302, url);
}

function loginUrl(origin: string, status: "error" | "cancelled"): string {
  return `${origin}/login?status=${status}`;
}

function logFailure(logger: Logger, error: unknown): void {
  logger.warn(
    { errorName: error instanceof Error ? error.name : "Error" },
    "Не удалось завершить вход"
  );
}

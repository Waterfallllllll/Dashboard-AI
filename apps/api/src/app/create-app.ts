import { CSRF_HEADER, healthResponseSchema } from "@dashboard/contracts";
import compression from "compression";
import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type Express, type Request } from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";

import type { AppConfig } from "../config/env.js";
import { pathOnly, type Logger } from "../infrastructure/logging/logger.js";
import { errorHandler, notFound } from "../middleware/error-handler.js";
import { createRateLimiter } from "../middleware/rate-limit.js";
import { requestId } from "../middleware/request-id.js";
import { requireCsrf } from "../middleware/require-csrf.js";
import { loadSession } from "../middleware/require-session.js";
import "../modules/auth/express-session.js";
import type { AuthService } from "../modules/auth/auth.service.js";
import { createAuthRouter } from "../modules/auth/auth.routes.js";
import { createUsersRouter } from "../modules/users/users.routes.js";
import type { UsersService } from "../modules/users/users.service.js";
import { asyncHandler } from "../shared/http/async-handler.js";
import { requestIdFrom } from "../shared/http/request-id.js";
import { sendParsed } from "../shared/http/respond.js";

export type AppDependencies = {
  readonly config: AppConfig;
  readonly logger: Logger;
  readonly readyCheck: () => Promise<boolean>;
  readonly authService: AuthService;
  readonly usersService: UsersService;
};

export function createApp(deps: AppDependencies): Express {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", deps.config.trustProxyHops);
  app.use(requestId);
  app.use(httpLogger(deps.logger));
  app.use(securityHeaders(deps.config));
  app.use((_req, res, next) => {
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
    next();
  });
  app.use(compression());
  app.use(express.json({ limit: deps.config.jsonBodyLimit }));
  app.use(cookieParser());
  app.use(cors(corsOptions(deps.config)));
  app.get("/health/live", (req, res) => {
    sendParsed(res, healthResponseSchema, 200, {
      data: { status: "live" },
      meta: { requestId: requestIdFrom(req) }
    });
  });
  app.get(
    "/health/ready",
    asyncHandler(async (req, res) => {
      const ready = await deps.readyCheck();
      sendParsed(res, healthResponseSchema, ready ? 200 : 503, {
        data: { status: ready ? "ready" : "unavailable" },
        meta: { requestId: requestIdFrom(req) }
      });
    })
  );
  app.use("/api/v1", loadSession(deps.authService));
  app.use("/api/v1", requireCsrf(deps.config));
  app.use("/api/v1", createRateLimiter(deps.config.apiRateLimit));
  app.use("/api/v1/auth", createAuthRouter(deps));
  app.use("/api/v1", createUsersRouter(deps.usersService));
  app.use(notFound);
  app.use(errorHandler);
  return app;
}

function securityHeaders(config: AppConfig) {
  return helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'none'"]
      }
    },
    crossOriginResourcePolicy: { policy: "same-site" },
    referrerPolicy: { policy: "no-referrer" },
    strictTransportSecurity: config.nodeEnv === "production"
  });
}

function corsOptions(config: AppConfig): cors.CorsOptions {
  const allowed = new Set(config.corsOrigins);

  return {
    origin(origin, callback) {
      if (origin === undefined || allowed.has(origin)) {
        callback(null, true);
        return;
      }

      callback(null, false);
    },
    credentials: true,
    methods: ["GET", "HEAD", "POST", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", CSRF_HEADER, "X-Request-Id", "Idempotency-Key"],
    maxAge: 600
  };
}

function httpLogger(logger: Logger) {
  return pinoHttp({
    logger,
    genReqId(req) {
      const request = req as Request;
      return request.requestId ?? "unknown-request";
    },
    customProps(req) {
      const request = req as Request;
      return { userId: request.session?.actor.userId };
    },
    autoLogging: {
      ignore(req) {
        return req.url?.startsWith("/health/") === true;
      }
    },
    serializers: {
      req(request) {
        return { method: request.method, url: pathOnly(request.url) };
      },
      res(response) {
        return { statusCode: response.statusCode };
      }
    }
  });
}

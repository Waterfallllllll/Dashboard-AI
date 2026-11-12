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
import type { CalendarService } from "../modules/calendar/calendar.service.js";
import { createCalendarRouter } from "../modules/calendar/calendar.routes.js";
import type { DashboardService } from "../modules/dashboard/dashboard.service.js";
import { createDashboardRouter } from "../modules/dashboard/dashboard.routes.js";
import type { IntegrationsService } from "../modules/integrations/integrations.service.js";
import { createIntegrationsRouter } from "../modules/integrations/integrations.routes.js";
import type { MetricsSource } from "../infrastructure/metrics/app-metrics.js";
import type { NotificationsService } from "../modules/notifications/notifications.service.js";
import { createNotificationsRouter } from "../modules/notifications/notifications.routes.js";
import type { WebhookService } from "../modules/notifications/webhook.service.js";
import { createWebhookRouter } from "../modules/notifications/webhook.routes.js";
import type { NewsService } from "../modules/news/news.service.js";
import { createNewsRouter } from "../modules/news/news.routes.js";
import type { RoutinesService } from "../modules/routines/routines.service.js";
import { createRoutinesRouter } from "../modules/routines/routines.routes.js";
import type { TimersService } from "../modules/timers/timers.service.js";
import { createTimersRouter } from "../modules/timers/timers.routes.js";
import { createUsersRouter } from "../modules/users/users.routes.js";
import type { UsersService } from "../modules/users/users.service.js";
import type { WeatherService } from "../modules/weather/weather.service.js";
import { createWeatherRouter } from "../modules/weather/weather.routes.js";
import type { WidgetsService } from "../modules/widgets/widgets.service.js";
import { createWidgetsRouter } from "../modules/widgets/widgets.routes.js";
import { asyncHandler } from "../shared/http/async-handler.js";
import { requestIdFrom } from "../shared/http/request-id.js";
import { sendParsed } from "../shared/http/respond.js";

export type AppDependencies = {
  readonly config: AppConfig;
  readonly logger: Logger;
  readonly readyCheck: () => Promise<boolean>;
  readonly authService: AuthService;
  readonly usersService: UsersService;
  readonly widgetsService: WidgetsService;
  readonly routinesService: RoutinesService;
  readonly timersService: TimersService;
  readonly dashboardService: DashboardService;
  readonly weatherService: WeatherService;
  readonly newsService: NewsService;
  readonly calendarService: CalendarService;
  readonly integrationsService: IntegrationsService;
  readonly notificationsService?: NotificationsService;
  readonly webhookService?: WebhookService;
  readonly metrics?: MetricsSource;
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
  if (deps.metrics) {
    app.get(
      "/metrics",
      asyncHandler(async (_req, res) => {
        res.setHeader("Content-Type", deps.metrics?.contentType ?? "text/plain; charset=utf-8");
        res.status(200).send(await deps.metrics?.text());
      })
    );
  }
  if (deps.webhookService) {
    app.use(
      "/api/v1/webhooks",
      createRateLimiter(deps.config.webhookRateLimit),
      createWebhookRouter(deps.webhookService)
    );
  }
  app.use("/api/v1", loadSession(deps.authService));
  app.use("/api/v1", requireCsrf(deps.config));
  app.use("/api/v1", createRateLimiter(deps.config.apiRateLimit));
  app.use("/api/v1/auth", createAuthRouter(deps));
  app.use("/api/v1", createUsersRouter(deps.usersService));
  app.use("/api/v1", createWidgetsRouter(deps.widgetsService));
  app.use("/api/v1", createRoutinesRouter(deps.routinesService));
  app.use("/api/v1", createTimersRouter(deps.timersService));
  app.use("/api/v1", createDashboardRouter(deps.dashboardService));
  app.use("/api/v1", createWeatherRouter(deps.weatherService));
  app.use("/api/v1", createNewsRouter(deps.newsService));
  app.use("/api/v1", createCalendarRouter(deps.calendarService));
  app.use(
    "/api/v1",
    createIntegrationsRouter(deps.integrationsService, deps.calendarService, deps.config)
  );
  if (deps.notificationsService) {
    app.use("/api/v1", createNotificationsRouter(deps.notificationsService));
  }
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
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"],
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

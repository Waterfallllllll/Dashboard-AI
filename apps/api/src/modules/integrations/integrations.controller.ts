import {
  googleConnectResponseSchema,
  integrationDeletionResponseSchema,
  integrationListResponseSchema,
  telegramLinkResponseSchema
} from "@dashboard/contracts";
import type { Request, Response } from "express";

import type { AppConfig } from "../../config/env.js";
import { asyncHandler } from "../../shared/http/async-handler.js";
import { requestIdFrom } from "../../shared/http/request-id.js";
import { requireActor, type Viewer } from "../../shared/http/require-actor.js";
import { sendParsed } from "../../shared/http/respond.js";
import { localDateInTimeZone } from "../../shared/local-date.js";
import { queryParams } from "../auth/oauth-request.js";
import type { CalendarService } from "../calendar/calendar.service.js";
import type { IntegrationsService } from "./integrations.service.js";

export function createIntegrationsController(
  integrations: IntegrationsService,
  calendar: CalendarService,
  config: AppConfig
) {
  return {
    list: asyncHandler(async (req, res) => {
      sendParsed(res, integrationListResponseSchema, 200, {
        data: await integrations.list(requireActor(req)),
        meta: { requestId: requestIdFrom(req) }
      });
    }),
    connectGoogle: asyncHandler(async (req, res) => {
      sendParsed(res, googleConnectResponseSchema, 200, {
        data: await integrations.beginGoogle(requireActor(req)),
        meta: { requestId: requestIdFrom(req) }
      });
    }),
    googleCallback: asyncHandler(async (req, res) => {
      const viewer = viewerFrom(req);

      if (!viewer) {
        redirect(res, calendarReturn(config.appOrigin, "error"));
        return;
      }

      try {
        const result = await integrations.completeGoogle(viewer, queryParams(requestQuery(req)));

        if (result === "connected") {
          try {
            await calendar.sync(viewer, localDateInTimeZone(new Date(), viewer.timezone));
          } catch {
            // Синхронизация не отменяет уже сохранённое подключение.
          }
        }

        redirect(res, calendarReturn(config.appOrigin, result));
      } catch {
        redirect(res, calendarReturn(config.appOrigin, "error"));
      }
    }),
    disconnectGoogle: asyncHandler(async (req, res) => {
      const actor = requireActor(req);
      await integrations.disconnect(actor, "google_calendar");
      await calendar.deleteForUser(actor.userId);
      sendParsed(res, integrationDeletionResponseSchema, 200, {
        data: { deleted: true },
        meta: { requestId: requestIdFrom(req) }
      });
    }),
    linkTelegram: asyncHandler(async (req, res) => {
      sendParsed(res, telegramLinkResponseSchema, 200, {
        data: await integrations.beginTelegram(requireActor(req)),
        meta: { requestId: requestIdFrom(req) }
      });
    }),
    disconnectTelegram: asyncHandler(async (req, res) => {
      await integrations.disconnect(requireActor(req), "telegram");
      sendParsed(res, integrationDeletionResponseSchema, 200, {
        data: { deleted: true },
        meta: { requestId: requestIdFrom(req) }
      });
    })
  };
}

function viewerFrom(req: Request): Viewer | null {
  const session = req.session;

  if (!session) {
    return null;
  }

  return {
    userId: session.actor.userId,
    sessionId: session.actor.sessionId,
    timezone: session.user.timezone,
    timeFormat: session.user.timeFormat
  };
}

function requestQuery(req: Request): Record<string, unknown> {
  const query: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(req.query)) {
    query[key] = value;
  }

  return query;
}

function calendarReturn(origin: string, status: "connected" | "cancelled" | "error"): string {
  return `${origin}/settings/integrations?calendar=${status}`;
}

function redirect(res: Response, url: string): void {
  res.setHeader("Cache-Control", "no-store");
  res.redirect(302, url);
}

import {
  notificationFeedResponseSchema,
  notificationPreferencesResponseSchema,
  notificationPreferencesSchema,
  pushSubscriptionCreateSchema,
  pushSubscriptionResponseSchema
} from "@dashboard/contracts";

import { parseRequest } from "../../shared/errors/api-error.js";
import { asyncHandler } from "../../shared/http/async-handler.js";
import { readRouteId } from "../../shared/http/idempotency-key.js";
import { requireActor } from "../../shared/http/require-actor.js";
import { requestIdFrom } from "../../shared/http/request-id.js";
import { sendParsed } from "../../shared/http/respond.js";
import type { NotificationsService } from "./notifications.service.js";

export function createNotificationsController(notifications: NotificationsService) {
  return {
    preferences: asyncHandler(async (req, res) => {
      sendParsed(res, notificationPreferencesResponseSchema, 200, {
        data: await notifications.preferences(requireActor(req)),
        meta: { requestId: requestIdFrom(req) }
      });
    }),
    replacePreferences: asyncHandler(async (req, res) => {
      const body = parseRequest(notificationPreferencesSchema, req.body);
      sendParsed(res, notificationPreferencesResponseSchema, 200, {
        data: await notifications.replacePreferences(requireActor(req), body),
        meta: { requestId: requestIdFrom(req) }
      });
    }),
    savePush: asyncHandler(async (req, res) => {
      const body = parseRequest(pushSubscriptionCreateSchema, req.body);
      const saved = await notifications.savePush(requireActor(req), body);
      sendParsed(res, pushSubscriptionResponseSchema, 201, {
        data: saved,
        meta: { requestId: requestIdFrom(req) }
      });
    }),
    revokePush: asyncHandler(async (req, res) => {
      await notifications.revokePush(requireActor(req), readRouteId(req));
      res.status(204).end();
    }),
    list: asyncHandler(async (req, res) => {
      sendParsed(res, notificationFeedResponseSchema, 200, {
        data: { items: await notifications.list(requireActor(req)) },
        meta: { requestId: requestIdFrom(req) }
      });
    })
  };
}

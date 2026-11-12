import { Router } from "express";

import { asyncHandler } from "../../shared/http/async-handler.js";
import { sendParsed } from "../../shared/http/respond.js";
import { healthResponseSchema } from "@dashboard/contracts";
import { requestIdFrom } from "../../shared/http/request-id.js";
import type { WebhookService } from "./webhook.service.js";

export function createWebhookRouter(webhooks: WebhookService) {
  const router = Router();
  router.post(
    "/telegram",
    asyncHandler(async (req, res) => {
      const body = readRecord(req.body);
      const message = readRecord(body.message);
      const from = readRecord(message.from);
      const text = message.text;
      const fromId = from.id;
      await webhooks.acceptTelegram({
        secret: req.header("x-telegram-bot-api-secret-token"),
        text: typeof text === "string" ? text : undefined,
        telegramUserId: typeof fromId === "number" ? String(fromId) : undefined
      });
      sendParsed(res, healthResponseSchema, 200, {
        data: { status: "live" },
        meta: { requestId: requestIdFrom(req) }
      });
    })
  );
  router.post(
    "/google-calendar",
    asyncHandler(async (req, res) => {
      await webhooks.acceptGoogleCalendar({
        token: req.header("x-goog-channel-token"),
        channelId: req.header("x-goog-channel-id"),
        resourceState: req.header("x-goog-resource-state")
      });
      sendParsed(res, healthResponseSchema, 200, {
        data: { status: "live" },
        meta: { requestId: requestIdFrom(req) }
      });
    })
  );
  return router;
}

function readRecord(value: unknown): Record<string, unknown> {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

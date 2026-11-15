import { API_ERROR_CODES } from "@dashboard/contracts";
import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { MemoryJobQueue } from "../../infrastructure/jobs/memory-job-queue.js";
import { errorHandler } from "../../middleware/error-handler.js";
import { WebhookService } from "./webhook.service.js";
import { createWebhookRouter } from "./webhook.routes.js";

const telegramSecret = "telegram-secret-value";
const googleToken = "google-calendar-token";
const startToken = "abcdefghijklmnopqrst";

describe("webhook проверяет секрет до полезной нагрузки", () => {
  it("не привязывает Telegram и не ставит синхронизацию без секрета", async () => {
    let links = 0;
    const jobs = new MemoryJobQueue();
    const webhooks = new WebhookService(
      telegramSecret,
      googleToken,
      jobs,
      async () => {
        links += 1;
        return "linked";
      },
      5,
      () => new Date("2026-11-15T09:00:00.000Z")
    );
    const app = express();
    app.use(express.json());
    app.use(createWebhookRouter(webhooks));
    app.use(errorHandler);

    const rejected = await request(app)
      .post("/telegram")
      .set("x-telegram-bot-api-secret-token", "wrong-secret-value")
      .send({
        message: { text: `/start ${startToken}`, from: { id: 42 } }
      });
    const calendar = await request(app)
      .post("/google-calendar")
      .set("x-goog-channel-token", "wrong-calendar-token")
      .set("x-goog-channel-id", "channel-1")
      .set("x-goog-resource-state", "exists");

    expect(rejected.status).toBe(401);
    expect(rejected.body.error.code).toBe(API_ERROR_CODES.unauthenticated);
    expect(links).toBe(0);
    expect(calendar.status).toBe(401);
    expect(await jobs.counts()).toMatchObject({ pending: 0 });
  });

  it("после верного секрета привязывает Telegram и ставит одну задачу календаря", async () => {
    let links = 0;
    const jobs = new MemoryJobQueue();
    const now = new Date("2026-11-15T09:00:00.000Z");
    const webhooks = new WebhookService(
      telegramSecret,
      googleToken,
      jobs,
      async () => {
        links += 1;
        return "linked";
      },
      5,
      () => now
    );
    const app = express();
    app.use(express.json());
    app.use(createWebhookRouter(webhooks));
    app.use(errorHandler);

    const linked = await request(app)
      .post("/telegram")
      .set("x-telegram-bot-api-secret-token", telegramSecret)
      .send({
        message: { text: `/start ${startToken}`, from: { id: 42 } }
      });
    const first = await request(app)
      .post("/google-calendar")
      .set("x-goog-channel-token", googleToken)
      .set("x-goog-channel-id", "channel-1")
      .set("x-goog-resource-state", "exists");
    const repeat = await request(app)
      .post("/google-calendar")
      .set("x-goog-channel-token", googleToken)
      .set("x-goog-channel-id", "channel-1")
      .set("x-goog-resource-state", "exists");

    expect(linked.status).toBe(200);
    expect(links).toBe(1);
    expect(first.status).toBe(200);
    expect(repeat.status).toBe(200);
    expect(await jobs.counts()).toMatchObject({ pending: 1 });
  });
});

import { describe, expect, it } from "vitest";

import type { FetchLike } from "../../infrastructure/http/provider-guard.js";
import type { Viewer } from "../../shared/http/require-actor.js";
import { MemoryNewsRepository } from "./news.repository.js";
import { NewsService } from "./news.service.js";
import type { NewsDraft } from "./news-model.js";

const now = new Date("2026-11-25T09:00:00.000Z");
const viewer: Viewer = {
  userId: "a".repeat(24),
  sessionId: "session",
  timezone: "Europe/Moscow",
  timeFormat: "24"
};

const stored: NewsDraft = {
  source: "OpenAI",
  official: true,
  title: "Модель вышла в открытый доступ",
  excerpt: "Короткий обзор релиза.",
  canonicalUrl: "https://openai.com/news/example",
  contentHash: "hash-example",
  publishedAt: new Date("2026-11-25T08:00:00.000Z"),
  language: "en",
  topics: ["llm"],
  imageUrl: null
};

describe("новости на дашборде", () => {
  it("отдаёт сохранённые записи, не дожидаясь RSS", async () => {
    const repository = new MemoryNewsRepository();
    await repository.upsertMany([stored], now);
    const service = new NewsService(
      repository,
      { read: async () => ({ limit: 5, sourceMode: "all" }) },
      hangingFetch,
      undefined,
      () => now
    );
    const started = Date.now();

    const section = await service.load(viewer);

    expect(Date.now() - started).toBeLessThan(200);
    expect(section.status).toBe("ready");
  });

  it("считает пустой кэш ошибкой, если ленты сразу недоступны", async () => {
    const service = new NewsService(
      new MemoryNewsRepository(),
      { read: async () => ({ limit: 5, sourceMode: "all" }) },
      async () => {
        throw new Error("provider down");
      },
      undefined,
      () => now
    );

    await expect(service.load(viewer)).resolves.toMatchObject({ status: "error" });
  });
});

const hangingFetch: FetchLike = () => new Promise(() => undefined);

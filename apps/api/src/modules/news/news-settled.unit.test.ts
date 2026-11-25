import { describe, expect, it } from "vitest";

import type { FetchLike } from "../../infrastructure/http/provider-guard.js";
import type { Viewer } from "../../shared/http/require-actor.js";
import { MemoryNewsRepository } from "./news.repository.js";
import { NewsService } from "./news.service.js";

const now = new Date("2026-11-25T09:00:00.000Z");
const viewer: Viewer = {
  userId: "a".repeat(24),
  sessionId: "session",
  timezone: "Europe/Moscow",
  timeFormat: "24"
};

const emptyRss = `<?xml version="1.0"?><rss version="2.0"><channel><title>Лента</title></channel></rss>`;
const freshRss = `<?xml version="1.0"?><rss version="2.0"><channel><title>OpenAI</title><item><title>Model release for developers</title><link>https://openai.com/news/model-release</link><pubDate>Wed, 25 Nov 2026 08:00:00 GMT</pubDate><description>A new model and API for developers.</description></item></channel></rss>`;

describe("догрузка новостей", () => {
  it("не называет незавершённое чтение лент пустым днём", async () => {
    const service = new NewsService(
      new MemoryNewsRepository(),
      { read: async () => ({ limit: 5, sourceMode: "all" }) },
      hangingFetch,
      undefined,
      () => now
    );
    const started = Date.now();

    await expect(service.load(viewer)).resolves.toEqual({ status: "pending" });
    expect(Date.now() - started).toBeLessThan(700);
  });

  it("после пустой ленты сообщает, что новостей нет, а свежую запись показывает", async () => {
    const preferences = { read: async () => ({ limit: 5, sourceMode: "all" as const }) };
    const empty = new NewsService(
      new MemoryNewsRepository(),
      preferences,
      rssFetch(emptyRss),
      undefined,
      () => now
    );
    const filled = new NewsService(
      new MemoryNewsRepository(),
      preferences,
      rssFetch(freshRss),
      undefined,
      () => now
    );

    await expect(empty.load(viewer)).resolves.toMatchObject({ status: "empty" });
    await expect(filled.refreshSection(viewer)).resolves.toMatchObject({
      status: "ready",
      items: [expect.objectContaining({ title: "Model release for developers" })]
    });
  });
});

const hangingFetch: FetchLike = () => new Promise(() => undefined);

function rssFetch(body: string): FetchLike {
  return async () =>
    new Response(body, {
      status: 200,
      headers: { "Content-Type": "application/rss+xml" }
    });
}

import { describe, expect, it } from "vitest";

import { getNewsRecency, hideNewsItem, visibleNewsItems } from "./news-freshness";
import type { NewsItem } from "./news-types";

const now = Date.UTC(2026, 9, 31, 12, 0, 0);

describe("news freshness", () => {
  it("отмечает материалы за текущий день и за последние 24 часа", () => {
    expect(getNewsRecency(now - 2 * 60 * 60 * 1000, now, "Europe/Moscow")).toBe("today");
    expect(getNewsRecency(now - 20 * 60 * 60 * 1000, now, "Europe/Moscow")).toBe("last-24h");
  });

  it("скрывает материалы по идентификатору", () => {
    const items: NewsItem[] = [
      {
        id: "a",
        title: "A",
        excerpt: "A",
        source: "OpenAI",
        official: true,
        topic: "LLM",
        publishedAt: now,
        url: "https://openai.com"
      }
    ];

    expect(visibleNewsItems(items, hideNewsItem([], "a"))).toEqual([]);
  });
});

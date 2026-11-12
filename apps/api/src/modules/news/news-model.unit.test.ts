import { describe, expect, it } from "vitest";

import {
  canonicalNewsUrl,
  classifyTopics,
  dedupeNews,
  plainExcerpt,
  type NewsDraft
} from "./news-model.js";

describe("лента новостей", () => {
  it("убирает разметку, канонизирует адрес и схлопывает похожие заголовки", () => {
    const excerpt = plainExcerpt("<style>.x{}</style><script>secret()</script><p>Новая модель</p>");
    expect(excerpt).toBe("Новая модель");
    expect(excerpt).not.toContain("secret");
    expect(canonicalNewsUrl("https://Example.com/post?utm_source=x&id=1#part")).toBe(
      "https://example.com/post?id=1"
    );
    expect(canonicalNewsUrl("http://example.com/post")).toBeNull();

    const first = draft("OpenAI released a new language model today");
    const similar = draft("OpenAI released a new language model today extra");
    const other = draft("Robotics lab published a benchmark paper");
    expect(dedupeNews([first, { ...first, title: "Другой заголовок" }, similar, other])).toEqual([
      first,
      other
    ]);
    expect(classifyTopics("Robotics benchmark", "")).toEqual(["robotics", "research"]);
    expect(classifyTopics("Коротко", "")).toEqual(["llm"]);
  });
});

function draft(title: string): NewsDraft {
  return {
    source: "OpenAI",
    official: true,
    title,
    excerpt: "Кратко",
    canonicalUrl: `https://example.com/${title.length}`,
    contentHash: `hash-${title.length}`,
    publishedAt: new Date("2026-11-12T09:00:00.000Z"),
    language: "en",
    topics: ["llm"],
    imageUrl: null
  };
}

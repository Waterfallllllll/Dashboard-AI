import { createHash } from "node:crypto";

import type { NewsTopic } from "@dashboard/contracts";

export type NewsFeedSource = {
  readonly source: string;
  readonly official: boolean;
  readonly language: "en" | "ru";
  readonly url: string;
};

export const NEWS_FEEDS: readonly NewsFeedSource[] = [
  {
    source: "OpenAI",
    official: true,
    language: "en",
    url: "https://openai.com/news/rss.xml"
  },
  {
    source: "Anthropic",
    official: true,
    language: "en",
    url: "https://www.anthropic.com/rss.xml"
  },
  {
    source: "Google DeepMind",
    official: true,
    language: "en",
    url: "https://deepmind.google/blog/rss.xml"
  },
  {
    source: "Meta AI",
    official: true,
    language: "en",
    url: "https://ai.meta.com/blog/rss/"
  },
  {
    source: "Mistral AI",
    official: true,
    language: "en",
    url: "https://mistral.ai/news/rss.xml"
  }
];

export const NEWS_FEED_HOSTS = [
  "openai.com",
  "www.anthropic.com",
  "deepmind.google",
  "ai.meta.com",
  "mistral.ai"
] as const;

const TOPIC_RULES: readonly { readonly topic: NewsTopic; readonly words: readonly string[] }[] = [
  { topic: "agents", words: ["agent", "agents", "агент"] },
  { topic: "vision", words: ["vision", "image", "multimodal", "зрени"] },
  { topic: "robotics", words: ["robot", "robotics", "робот"] },
  { topic: "research", words: ["research", "paper", "benchmark", "исследован"] },
  { topic: "devtools", words: ["api", "sdk", "developer", "tool", "инструмент"] },
  { topic: "business", words: ["funding", "regulation", "policy", "enterprise", "бизнес"] },
  { topic: "llm", words: ["model", "gpt", "llm", "claude", "gemini", "language", "модел"] }
];

export type NewsDraft = {
  readonly source: string;
  readonly official: boolean;
  readonly title: string;
  readonly excerpt: string;
  readonly canonicalUrl: string;
  readonly contentHash: string;
  readonly publishedAt: Date;
  readonly language: "en" | "ru";
  readonly topics: readonly NewsTopic[];
  readonly imageUrl: string | null;
};

export function classifyTopics(title: string, excerpt: string): NewsTopic[] {
  const text = `${title} ${excerpt}`.toLowerCase();
  const topics = TOPIC_RULES.filter((rule) => rule.words.some((word) => text.includes(word))).map(
    (rule) => rule.topic
  );
  return topics.length > 0 ? topics : ["llm"];
}

export function plainExcerpt(value: string): string {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 280);
}

export function canonicalNewsUrl(value: string): string | null {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    return null;
  }

  if (url.protocol !== "https:" || url.username !== "" || url.password !== "") {
    return null;
  }

  url.hash = "";
  url.hostname = url.hostname.toLowerCase();

  for (const key of [...url.searchParams.keys()]) {
    if (key.startsWith("utm_") || key === "fbclid") {
      url.searchParams.delete(key);
    }
  }

  const href = url.toString();
  return href.length <= 2048 ? href : null;
}

export function contentHash(canonicalUrl: string): string {
  return createHash("sha256").update(canonicalUrl).digest("hex");
}

export function dedupeNews(items: readonly NewsDraft[]): NewsDraft[] {
  const seenUrls = new Set<string>();
  const seenTitles: string[] = [];
  const unique: NewsDraft[] = [];

  for (const item of items) {
    const title = normalizeTitle(item.title);

    if (seenUrls.has(item.contentHash) || title.length === 0 || isSimilarTitle(title, seenTitles)) {
      continue;
    }

    seenUrls.add(item.contentHash);
    seenTitles.push(title);
    unique.push(item);
  }

  return unique;
}

export function safeImageUrl(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  const canonical = canonicalNewsUrl(value);
  return canonical && canonical.length <= 2048 ? canonical : null;
}

function normalizeTitle(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function isSimilarTitle(title: string, existing: readonly string[]): boolean {
  return existing.some((other) => other === title || jaccard(title, other) >= 0.75);
}

function jaccard(left: string, right: string): number {
  const a = new Set(left.split(" ").filter((word) => word.length > 2));
  const b = new Set(right.split(" ").filter((word) => word.length > 2));

  if (a.size < 4 || b.size < 4) {
    return 0;
  }

  let shared = 0;

  for (const word of a) {
    if (b.has(word)) {
      shared += 1;
    }
  }

  return shared / (a.size + b.size - shared);
}

import { SECTION_ERROR_MESSAGE } from "@dashboard/contracts";
import type { NewsItem, NewsQuery, NewsSection } from "@dashboard/contracts";
import Parser from "rss-parser";

import {
  CircuitBreaker,
  ProviderUnavailableError,
  fetchAllowlisted,
  type FetchLike
} from "../../infrastructure/http/provider-guard.js";
import { localDateInTimeZone } from "../../shared/local-date.js";
import type { Viewer } from "../../shared/http/require-actor.js";
import type { Actor } from "../auth/auth.types.js";
import type { NewsRepository, StoredNewsItem } from "./news.repository.js";
import {
  NEWS_FEED_HOSTS,
  NEWS_FEEDS,
  canonicalNewsUrl,
  classifyTopics,
  contentHash,
  dedupeNews,
  plainExcerpt,
  safeImageUrl,
  type NewsDraft,
  type NewsFeedSource
} from "./news-model.js";

const FRESH_MS = 15 * 60 * 1000;
const REFRESH_BUDGET_MS = 400;
const DAY_MS = 24 * 60 * 60 * 1000;
const parser = new Parser();
const officialSources = new Set(
  NEWS_FEEDS.filter((feed) => feed.official).map((feed) => feed.source)
);

export type NewsPreferencePort = {
  read(actor: Actor): Promise<{ limit: number; sourceMode: "all" | "official" }>;
};

export class NewsService {
  private refreshedAt: number | null = null;
  private refreshTask: Promise<void> | null = null;
  private readonly breakers = new Map<string, CircuitBreaker>();

  constructor(
    private readonly news: NewsRepository,
    private readonly preferences: NewsPreferencePort,
    private readonly fetchImpl: FetchLike,
    private readonly feeds: readonly NewsFeedSource[] = NEWS_FEEDS,
    private readonly now: () => Date = () => new Date()
  ) {}

  async load(viewer: Viewer, _date?: string, query?: NewsQuery): Promise<NewsSection> {
    const preference = await this.preferences.read(viewer).catch(() => ({
      limit: 5,
      sourceMode: "all" as const
    }));
    const stored = await this.news.recent(this.now(), 50);
    const items = visibleItems(stored, viewer, preference, query, this.now());
    const fresh = this.refreshedAt !== null && this.now().getTime() - this.refreshedAt < FRESH_MS;

    const latest = items[0];

    if (latest) {
      if (!fresh) {
        void this.refreshShared().then(
          () => {
            this.refreshedAt = this.now().getTime();
          },
          () => undefined
        );
      }

      return {
        status: "ready",
        updatedAt:
          this.refreshedAt === null ? latest.publishedAt : new Date(this.refreshedAt).toISOString(),
        items
      };
    }

    if (fresh && this.refreshedAt !== null) {
      return { status: "empty", updatedAt: new Date(this.refreshedAt).toISOString() };
    }

    const outcome = await budget(
      this.refreshShared().then(
        () => "ok" as const,
        () => "fail" as const
      ),
      "timeout" as const,
      REFRESH_BUDGET_MS
    );

    if (outcome === "timeout") {
      void this.refreshShared().then(
        () => {
          this.refreshedAt = this.now().getTime();
        },
        () => undefined
      );
      return { status: "pending" };
    }

    if (outcome === "fail") {
      return { status: "error", message: SECTION_ERROR_MESSAGE };
    }

    this.refreshedAt = this.now().getTime();
    const refreshed = visibleItems(
      await this.news.recent(this.now(), 50),
      viewer,
      preference,
      query,
      this.now()
    );

    if (refreshed.length === 0 || this.refreshedAt === null) {
      return {
        status: "empty",
        updatedAt: this.refreshedAt === null ? null : new Date(this.refreshedAt).toISOString()
      };
    }

    return {
      status: "ready",
      updatedAt: new Date(this.refreshedAt).toISOString(),
      items: refreshed
    };
  }

  async refresh(): Promise<void> {
    return this.refreshShared();
  }

  async loadSettled(viewer: Viewer, query?: NewsQuery): Promise<NewsSection> {
    if (this.refreshTask) {
      return this.afterRefresh(viewer, query);
    }

    const current = await this.load(viewer, undefined, query);
    return current.status === "pending" ? this.afterRefresh(viewer, query) : current;
  }

  async refreshSection(viewer: Viewer, query?: NewsQuery): Promise<NewsSection> {
    return this.afterRefresh(viewer, query);
  }

  private async afterRefresh(viewer: Viewer, query?: NewsQuery): Promise<NewsSection> {
    try {
      await this.refreshShared();
      this.refreshedAt = this.now().getTime();
    } catch {
      return { status: "error", message: SECTION_ERROR_MESSAGE };
    }

    const section = await this.load(viewer, undefined, query);
    const refreshedAt = this.refreshedAt;

    if (section.status === "pending" || refreshedAt === null) {
      return {
        status: "empty",
        updatedAt: refreshedAt === null ? null : new Date(refreshedAt).toISOString()
      };
    }

    return section;
  }

  private refreshShared(): Promise<void> {
    this.refreshTask ??= this.refreshFeeds().finally(() => {
      this.refreshTask = null;
    });
    return this.refreshTask;
  }

  private async refreshFeeds(): Promise<void> {
    const results = await Promise.allSettled(this.feeds.map((feed) => this.readFeed(feed)));
    const drafts = dedupeNews(
      results.flatMap((result) => (result.status === "fulfilled" ? result.value : []))
    );

    if (drafts.length === 0 && results.every((result) => result.status === "rejected")) {
      throw new ProviderUnavailableError("news");
    }

    await this.news.upsertMany(drafts, this.now());
  }

  private async readFeed(feed: NewsFeedSource): Promise<NewsDraft[]> {
    const url = new URL(feed.url);
    const body = await fetchAllowlisted({
      url,
      allowHosts: NEWS_FEED_HOSTS,
      provider: "news",
      fetchImpl: this.fetchImpl,
      breaker: this.breakerFor(url.hostname),
      maxAttempts: 1
    });
    const parsed = await parser.parseString(body);
    return (parsed.items ?? []).flatMap((item) => draftFrom(feed, item));
  }

  private breakerFor(host: string): CircuitBreaker {
    const existing = this.breakers.get(host);

    if (existing) {
      return existing;
    }

    const created = new CircuitBreaker();
    this.breakers.set(host, created);
    return created;
  }
}

function draftFrom(feed: NewsFeedSource, item: Parser.Item): NewsDraft[] {
  const canonical = canonicalNewsUrl(item.link ?? "");
  const title = plainExcerpt(item.title ?? "").slice(0, 300);
  const publishedAt = item.isoDate ? new Date(item.isoDate) : null;

  if (!canonical || title.length === 0 || !publishedAt || Number.isNaN(publishedAt.getTime())) {
    return [];
  }

  const excerpt = plainExcerpt(item.contentSnippet || item.content || item.summary || "");
  const topics = classifyTopics(title, excerpt);
  const imageUrl = safeImageUrl(item.enclosure?.url);

  return [
    {
      source: feed.source,
      official: feed.official,
      title,
      excerpt,
      canonicalUrl: canonical,
      contentHash: contentHash(canonical),
      publishedAt,
      language: feed.language,
      topics,
      imageUrl
    }
  ];
}

function visibleItems(
  stored: readonly StoredNewsItem[],
  viewer: Viewer,
  preference: { limit: number; sourceMode: "all" | "official" },
  query: NewsQuery | undefined,
  now: Date
): NewsItem[] {
  const sourceMode = query?.sourceMode ?? preference.sourceMode;
  const language = query?.language;
  const today = localDateInTimeZone(now, viewer.timezone);
  const mapped = stored.flatMap((item) => {
    if (language && item.language !== language) {
      return [];
    }

    const official = officialSources.has(item.source);

    if (sourceMode === "official" && !official) {
      return [];
    }

    const topic = item.topics[0];

    if (!topic) {
      return [];
    }

    const newsItem: NewsItem = {
      id: item.id,
      title: item.title,
      excerpt: item.excerpt.slice(0, 280),
      source: item.source,
      official,
      topic,
      topics: [...item.topics],
      publishedAt: item.publishedAt.toISOString(),
      url: item.canonicalUrl,
      imageUrl: item.imageUrl
    };
    const current = localDateInTimeZone(item.publishedAt, viewer.timezone) === today;
    const recent = now.getTime() - item.publishedAt.getTime() <= DAY_MS;
    return current || recent ? [{ item: newsItem, current }] : [];
  });
  const currentItems = mapped.filter((entry) => entry.current).map((entry) => entry.item);
  const recentItems = mapped.filter((entry) => !entry.current).map((entry) => entry.item);
  return [...currentItems, ...recentItems].slice(0, preference.limit);
}

function budget<T>(pending: Promise<T>, fallback: T, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<T>((resolve) => {
    timer = setTimeout(() => {
      resolve(fallback);
    }, ms);
  });

  return Promise.race([pending, deadline]).finally(() => {
    clearTimeout(timer);
  });
}

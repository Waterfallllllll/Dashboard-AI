import type { NewsTopic } from "@dashboard/contracts";

import { newEntityId } from "../../shared/public-id.js";
import type { NewsDraft } from "./news-model.js";

export type StoredNewsItem = {
  readonly id: string;
  readonly source: string;
  readonly title: string;
  readonly excerpt: string;
  readonly canonicalUrl: string;
  readonly publishedAt: Date;
  readonly language: "en" | "ru";
  readonly topics: readonly NewsTopic[];
  readonly imageUrl: string | null;
};

export type NewsRepository = {
  upsertMany(items: readonly NewsDraft[], now: Date): Promise<void>;
  recent(now: Date, limit: number): Promise<readonly StoredNewsItem[]>;
};

export class MemoryNewsRepository implements NewsRepository {
  private readonly items: StoredNewsItem[] = [];

  async upsertMany(items: readonly NewsDraft[], now: Date): Promise<void> {
    for (const item of items) {
      const existing = this.items.find((stored) => stored.canonicalUrl === item.canonicalUrl);

      if (existing) {
        continue;
      }

      this.items.push({
        id: newEntityId(),
        source: item.source,
        title: item.title,
        excerpt: item.excerpt,
        canonicalUrl: item.canonicalUrl,
        publishedAt: item.publishedAt,
        language: item.language,
        topics: item.topics,
        imageUrl: item.imageUrl
      });
    }

    void now;
  }

  async recent(now: Date, limit: number): Promise<readonly StoredNewsItem[]> {
    return this.items
      .filter((item) => item.publishedAt.getTime() <= now.getTime())
      .sort((left, right) => right.publishedAt.getTime() - left.publishedAt.getTime())
      .slice(0, limit);
  }
}

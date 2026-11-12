import { ObjectId, type Db } from "mongodb";

import type { NewsItemDocument } from "../../infrastructure/mongodb/collection-catalog.js";
import type { NewsDraft } from "./news-model.js";
import type { NewsTopic } from "@dashboard/contracts";

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

export class MongoNewsRepository implements NewsRepository {
  constructor(private readonly db: Db) {}

  async upsertMany(items: readonly NewsDraft[], now: Date): Promise<void> {
    if (items.length === 0) {
      return;
    }

    await this.db.collection<NewsItemDocument>("news_items").bulkWrite(
      items.map((item) => ({
        updateOne: {
          filter: { contentHash: item.contentHash },
          update: {
            $setOnInsert: {
              schemaVersion: 1 as const,
              contentHash: item.contentHash,
              createdAt: now
            },
            $set: {
              source: item.source,
              title: item.title,
              excerpt: item.excerpt,
              canonicalUrl: item.canonicalUrl,
              publishedAt: item.publishedAt,
              language: item.language,
              topics: [...item.topics],
              imageUrl: item.imageUrl
            }
          },
          upsert: true
        }
      })),
      { ordered: false }
    );
  }

  async recent(now: Date, limit: number): Promise<readonly StoredNewsItem[]> {
    const documents = await this.db
      .collection<NewsItemDocument>("news_items")
      .find({ publishedAt: { $lte: now } })
      .sort({ publishedAt: -1 })
      .limit(limit)
      .toArray();

    return documents.flatMap((document) => {
      const item = toStored(document);
      return item ? [item] : [];
    });
  }
}

export class MemoryNewsRepository implements NewsRepository {
  private readonly items: StoredNewsItem[] = [];

  async upsertMany(items: readonly NewsDraft[], now: Date): Promise<void> {
    for (const item of items) {
      const existing = this.items.find((stored) => stored.canonicalUrl === item.canonicalUrl);

      if (existing) {
        continue;
      }

      this.items.push({
        id: new ObjectId().toHexString(),
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

function toStored(document: NewsItemDocument): StoredNewsItem | null {
  const topics = document.topics.filter(isTopic);

  if (topics.length === 0 || (document.language !== "en" && document.language !== "ru")) {
    return null;
  }

  return {
    id: document._id.toHexString(),
    source: document.source,
    title: document.title,
    excerpt: document.excerpt,
    canonicalUrl: document.canonicalUrl,
    publishedAt: document.publishedAt,
    language: document.language,
    topics,
    imageUrl: document.imageUrl
  };
}

function isTopic(value: string): value is NewsTopic {
  return (
    value === "llm" ||
    value === "agents" ||
    value === "research" ||
    value === "devtools" ||
    value === "vision" ||
    value === "robotics" ||
    value === "business"
  );
}

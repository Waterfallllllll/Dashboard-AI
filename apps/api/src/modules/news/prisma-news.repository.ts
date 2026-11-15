import type { NewsTopic } from "@dashboard/contracts";

import type { PrismaClient } from "../../generated/prisma/client.js";
import type { NewsDraft } from "./news-model.js";
import type { NewsRepository, StoredNewsItem } from "./news.repository.js";

export class PrismaNewsRepository implements NewsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async upsertMany(items: readonly NewsDraft[], now: Date): Promise<void> {
    for (const item of items) {
      await this.prisma.newsItem.upsert({
        where: { contentHash: item.contentHash },
        create: {
          source: item.source,
          title: item.title,
          excerpt: item.excerpt,
          canonicalUrl: item.canonicalUrl,
          contentHash: item.contentHash,
          publishedAt: item.publishedAt,
          language: item.language,
          topics: [...item.topics],
          imageUrl: item.imageUrl,
          createdAt: now
        },
        update: {
          source: item.source,
          title: item.title,
          excerpt: item.excerpt,
          canonicalUrl: item.canonicalUrl,
          publishedAt: item.publishedAt,
          language: item.language,
          topics: [...item.topics],
          imageUrl: item.imageUrl
        }
      });
    }
  }

  async recent(now: Date, limit: number): Promise<readonly StoredNewsItem[]> {
    const rows = await this.prisma.newsItem.findMany({
      where: { publishedAt: { lte: now } },
      orderBy: { publishedAt: "desc" },
      take: limit
    });

    return rows.flatMap((row) => {
      const item = toStored(row);
      return item ? [item] : [];
    });
  }
}

function toStored(row: {
  id: string;
  source: string;
  title: string;
  excerpt: string;
  canonicalUrl: string;
  publishedAt: Date;
  language: string;
  topics: string[];
  imageUrl: string | null;
}): StoredNewsItem | null {
  const topics = row.topics.filter(isTopic);

  if (topics.length === 0 || (row.language !== "en" && row.language !== "ru")) {
    return null;
  }

  return {
    id: row.id,
    source: row.source,
    title: row.title,
    excerpt: row.excerpt,
    canonicalUrl: row.canonicalUrl,
    publishedAt: row.publishedAt,
    language: row.language,
    topics,
    imageUrl: row.imageUrl
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

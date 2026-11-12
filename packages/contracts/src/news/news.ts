import { z } from "zod";

import { apiSuccessSchema } from "../common/api-response.js";
import { entityIdSchema, httpsUrlSchema, utcDateTimeSchema } from "../common/primitives.js";
import { newsSourceModeSchema } from "../widgets/preferences.js";

export const NEWS_TOPICS = [
  "llm",
  "agents",
  "research",
  "devtools",
  "vision",
  "robotics",
  "business"
] as const;

export const newsTopicSchema = z.enum(NEWS_TOPICS, { error: "Неизвестная тема новости." });

export const newsLanguageSchema = z.enum(["ru", "en"], { error: "Язык ленты — ru или en." });

export const newsItemSchema = z.strictObject({
  id: entityIdSchema,
  title: z.string().min(1).max(300),
  excerpt: z.string().max(280),
  source: z.string().min(1).max(120),
  official: z.boolean(),
  topic: newsTopicSchema,
  topics: z.array(newsTopicSchema).min(1).max(7),
  publishedAt: utcDateTimeSchema,
  url: httpsUrlSchema,
  imageUrl: httpsUrlSchema.nullable()
});

export const newsFeedSchema = z.strictObject({
  updatedAt: utcDateTimeSchema.nullable(),
  items: z.array(newsItemSchema).max(10)
});

export const newsQuerySchema = z.strictObject({
  language: newsLanguageSchema.optional(),
  sourceMode: newsSourceModeSchema.optional()
});

export const newsResponseSchema = apiSuccessSchema(newsFeedSchema);

export type NewsTopic = z.infer<typeof newsTopicSchema>;
export type NewsItem = z.infer<typeof newsItemSchema>;
export type NewsFeed = z.infer<typeof newsFeedSchema>;
export type NewsQuery = z.infer<typeof newsQuerySchema>;

export const NEWS_TOPICS = [
  "LLM",
  "Агенты",
  "Исследования",
  "Инструменты",
  "Зрение",
  "Робототехника",
  "Бизнес"
] as const;

export type NewsTopic = (typeof NEWS_TOPICS)[number];

export type NewsItem = Readonly<{
  id: string;
  title: string;
  excerpt: string;
  source: string;
  official: boolean;
  topic: NewsTopic;
  publishedAt: number;
  url: string;
}>;

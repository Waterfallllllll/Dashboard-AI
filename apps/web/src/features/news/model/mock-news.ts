import type { NewsItem } from "./news-types";

export const MOCK_NEWS_UPDATED_AT_OFFSET_MS = 12 * 60 * 1000;

export function createMockNews(now = Date.now()): readonly NewsItem[] {
  return [
    {
      id: "openai-agents",
      title: "OpenAI расширила инструменты для агентных рабочих процессов",
      excerpt: "Короткий обзор новых API для планирования шагов и контроля инструментов.",
      source: "OpenAI",
      official: true,
      topic: "Агенты",
      publishedAt: now - 90 * 60 * 1000,
      url: "https://openai.com/blog"
    },
    {
      id: "anthropic-safety",
      title: "Anthropic опубликовала отчёт об оценке безопасности модели",
      excerpt: "Исследователи описали методику красных команд и ограничения выводов.",
      source: "Anthropic",
      official: true,
      topic: "Исследования",
      publishedAt: now - 3 * 60 * 60 * 1000,
      url: "https://www.anthropic.com/news"
    },
    {
      id: "deepmind-vision",
      title: "Google DeepMind показала прогресс в моделях восприятия",
      excerpt: "Новый бенчмарк сравнивает точность описания сцен и инструкций.",
      source: "Google DeepMind",
      official: true,
      topic: "Зрение",
      publishedAt: now - 5 * 60 * 60 * 1000,
      url: "https://deepmind.google/discover/blog"
    },
    {
      id: "mistral-tools",
      title: "Mistral открыла обновлённый стек для локальной разработки",
      excerpt: "В анонсе — SDK, квантование и сценарии для IDE.",
      source: "Mistral AI",
      official: true,
      topic: "Инструменты",
      publishedAt: now - 18 * 60 * 60 * 1000,
      url: "https://mistral.ai/news"
    },
    {
      id: "meta-regulation",
      title: "Meta AI прокомментировала правила прозрачности моделей в ЕС",
      excerpt: "Компания описала, какие карточки моделей появятся в открытом доступе.",
      source: "Meta AI",
      official: false,
      topic: "Бизнес",
      publishedAt: now - 22 * 60 * 60 * 1000,
      url: "https://ai.meta.com/blog"
    }
  ];
}

export const MOCK_NEWS = createMockNews();

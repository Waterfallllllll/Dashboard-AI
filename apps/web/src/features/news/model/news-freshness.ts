import { isSameDay } from "date-fns";

import { toZonedDate } from "@/lib/format/date-time";

import type { NewsItem } from "./news-types";

export type NewsRecency = "today" | "last-24h";

export function getNewsRecency(publishedAt: number, now: number, timeZone: string): NewsRecency {
  if (isSameDay(toZonedDate(publishedAt, timeZone), toZonedDate(now, timeZone))) {
    return "today";
  }

  return "last-24h";
}

export function getNewsRecencyLabel(recency: NewsRecency): string | null {
  return recency === "last-24h" ? "за последние 24 часа" : null;
}

export function hideNewsItem(hiddenIds: readonly string[], id: string): string[] {
  return hiddenIds.includes(id) ? [...hiddenIds] : [...hiddenIds, id];
}

export function visibleNewsItems(
  items: readonly NewsItem[],
  hiddenIds: readonly string[]
): NewsItem[] {
  return items.filter((item) => !hiddenIds.includes(item.id));
}

export function selectVisibleNews(
  items: readonly NewsItem[],
  options: Readonly<{ itemLimit?: number; sourceMode?: "all" | "official" }> = {}
): NewsItem[] {
  const filtered =
    options.sourceMode === "official" ? items.filter((item) => item.official) : [...items];

  return typeof options.itemLimit === "number" ? filtered.slice(0, options.itemLimit) : filtered;
}

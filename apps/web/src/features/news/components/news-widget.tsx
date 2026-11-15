"use client";

import { formatDistance } from "date-fns";
import { ru } from "date-fns/locale";
import { ExternalLink } from "lucide-react";
import { useState } from "react";

import {
  getNewsRecency,
  getNewsRecencyLabel,
  hideNewsItem,
  selectVisibleNews,
  visibleNewsItems
} from "../model/news-freshness";
import { createMockNews } from "../model/mock-news";
import type { NewsItem } from "../model/news-types";

import styles from "./news-widget.module.scss";

type NewsWidgetProps = Readonly<{
  itemLimit?: number;
  items?: readonly NewsItem[];
  now?: number;
  sourceMode?: "all" | "official";
  timeZone: string;
}>;

export function NewsWidget({
  itemLimit,
  items: itemsProp,
  now: nowProp,
  sourceMode,
  timeZone
}: NewsWidgetProps) {
  const [capturedNow] = useState(() => nowProp ?? Date.now());
  const now = nowProp ?? capturedNow;
  const [hiddenIds, setHiddenIds] = useState<readonly string[]>([]);

  if (itemsProp && itemsProp.length === 0) {
    return <p className={styles.empty}>Свежих материалов пока нет.</p>;
  }

  const items = selectVisibleNews(visibleNewsItems(itemsProp ?? createMockNews(now), hiddenIds), {
    ...(itemLimit !== undefined ? { itemLimit } : {}),
    ...(sourceMode !== undefined ? { sourceMode } : {})
  });

  if (items.length === 0) {
    return <p className={styles.empty}>Скрытые материалы можно вернуть в настройках виджета.</p>;
  }

  return (
    <ul className={styles.list}>
      {items.map((item, index) => {
        const recencyLabel = getNewsRecencyLabel(getNewsRecency(item.publishedAt, now, timeZone));

        return (
          <li className={styles.item} data-lead={index === 0 ? "true" : "false"} key={item.id}>
            <div className={styles.meta}>
              <span>{item.source}</span>
              <span>{formatDistance(item.publishedAt, now, { addSuffix: true, locale: ru })}</span>
              {recencyLabel ? <span className={styles.badge}>{recencyLabel}</span> : null}
              <span className={styles.topic}>{item.topic}</span>
            </div>
            <a className={styles.title} href={item.url} rel="noreferrer noopener" target="_blank">
              <span>{item.title}</span>
              <ExternalLink aria-hidden="true" strokeWidth={1.8} />
              <span className={styles.liveRegion}>Открыть оригинал</span>
            </a>
            <p className={styles.excerpt}>{item.excerpt}</p>
            <button
              className={styles.hide}
              onClick={() => {
                setHiddenIds((current) => hideNewsItem(current, item.id));
              }}
              type="button"
            >
              Не интересно
            </button>
          </li>
        );
      })}
    </ul>
  );
}

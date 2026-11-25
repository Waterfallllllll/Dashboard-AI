"use client";

import {
  CalendarDays,
  CircleAlert,
  Clock3,
  CloudSun,
  Inbox,
  ListChecks,
  MoreHorizontal,
  Newspaper,
  RefreshCw,
  ShieldAlert,
  Timer,
  Unplug,
  type LucideIcon
} from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

import { StatusBadge } from "@/components/ui/status-badge";

import { WIDGET_TITLES, type WidgetPlacement, type WidgetType } from "../model/widget-layout";
import {
  canRefreshWidget,
  getWidgetStatusCopy,
  getWidgetStatusLabel,
  showsStaleNotice,
  showsWidgetContent,
  STALE_DATA_NOTICE,
  type WidgetStatus
} from "../model/widget-status";

import styles from "./widget-card.module.scss";

const widgetIcons: Readonly<Record<WidgetType, LucideIcon>> = {
  datetime: Clock3,
  weather: CloudSun,
  calendar: CalendarDays,
  routines: ListChecks,
  timer: Timer,
  news: Newspaper
};

const statusIcons: Readonly<
  Record<"empty" | "error" | "permission-required" | "disconnected", LucideIcon>
> = {
  empty: Inbox,
  error: CircleAlert,
  "permission-required": ShieldAlert,
  disconnected: Unplug
};

type WidgetCardProps = Readonly<{
  widget: WidgetPlacement;
  status: WidgetStatus;
  children?: ReactNode;
  background?: ReactNode;
  tone?: "default" | "weather";
  surface?: string;
  updatedAtLabel?: string;
  onRetry?: () => void;
  onRefresh?: () => void;
  emptyMode?: "section" | "placeholder";
}>;

export function WidgetCard({
  background,
  children,
  emptyMode = "section",
  onRefresh,
  onRetry,
  status,
  surface,
  tone = "default",
  updatedAtLabel,
  widget
}: WidgetCardProps) {
  const Icon = widgetIcons[widget.type];
  const title = WIDGET_TITLES[widget.type];
  const titleId = useId();
  const menuId = useId();
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const statusCopy = getWidgetStatusCopy(widget.type, status, emptyMode);
  const showRefresh = canRefreshWidget(status, widget.hasExternalSource);
  const busy = status === "loading";

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  return (
    <article
      aria-busy={busy}
      aria-labelledby={titleId}
      className={styles.card}
      data-size={widget.size}
      data-status={status}
      data-surface={surface}
      data-tone={tone}
      data-widget={widget.type}
    >
      {background ? (
        <div aria-hidden="true" className={styles.background}>
          {background}
        </div>
      ) : null}
      <header className={styles.header}>
        <div className={styles.identity}>
          <span aria-hidden="true" className={styles.icon}>
            <Icon strokeWidth={1.8} />
          </span>
          <h2 className={styles.title} id={titleId}>
            {title}
          </h2>
        </div>
        <div className={styles.actions} ref={menuRef}>
          {showRefresh ? (
            <button
              aria-label={`Обновить виджет «${title}»`}
              className={styles.iconButton}
              onClick={() => {
                onRefresh?.();
                setMenuOpen(false);
              }}
              type="button"
            >
              <RefreshCw strokeWidth={1.8} />
            </button>
          ) : null}
          <button
            aria-controls={menuId}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            aria-label={`Действия виджета «${title}»`}
            className={styles.iconButton}
            onClick={() => {
              setMenuOpen((open) => !open);
            }}
            type="button"
          >
            <MoreHorizontal strokeWidth={1.8} />
          </button>
          {menuOpen ? (
            <ul className={styles.menu} id={menuId} role="menu">
              {widget.hasExternalSource ? (
                <li role="none">
                  <button
                    className={styles.menuItem}
                    disabled={!showRefresh}
                    onClick={() => {
                      onRefresh?.();
                      setMenuOpen(false);
                    }}
                    role="menuitem"
                    type="button"
                  >
                    Обновить
                  </button>
                </li>
              ) : null}
              <li role="none">
                <Link
                  className={styles.menuItem}
                  href="/settings/widgets"
                  onClick={() => {
                    setMenuOpen(false);
                  }}
                  role="menuitem"
                >
                  Настроить виджеты
                </Link>
              </li>
            </ul>
          ) : null}
        </div>
      </header>

      <div className={styles.body}>
        <p aria-live="polite" className={styles.liveRegion}>
          {getWidgetStatusLabel(status)}
        </p>
        {busy ? <WidgetSkeleton title={title} /> : null}
        {showsWidgetContent(status) ? <div className={styles.content}>{children}</div> : null}
        {statusCopy ? (
          <WidgetStatusPanel
            copy={statusCopy}
            status={status}
            onRetry={() => {
              onRetry?.();
            }}
          />
        ) : null}
      </div>

      {updatedAtLabel || showsStaleNotice(status) ? (
        <footer className={styles.footer}>
          {showsStaleNotice(status) ? (
            <StatusBadge tone="warning">{STALE_DATA_NOTICE}</StatusBadge>
          ) : null}
          {updatedAtLabel ? <span suppressHydrationWarning>Обновлено {updatedAtLabel}</span> : null}
        </footer>
      ) : null}
    </article>
  );
}

function WidgetSkeleton({ title }: Readonly<{ title: string }>) {
  return (
    <div className={styles.skeleton}>
      <span className={styles.liveRegion}>Загружаем «{title}»</span>
      <span aria-hidden="true" className={styles.skeletonLine} />
      <span aria-hidden="true" className={styles.skeletonLine} />
      <span aria-hidden="true" className={styles.skeletonLine} />
      <span aria-hidden="true" className={styles.skeletonLine} />
    </div>
  );
}

function WidgetStatusPanel({
  copy,
  onRetry,
  status
}: Readonly<{
  copy: NonNullable<ReturnType<typeof getWidgetStatusCopy>>;
  onRetry: () => void;
  status: WidgetStatus;
}>) {
  const StatusIcon =
    status === "empty" ||
    status === "error" ||
    status === "permission-required" ||
    status === "disconnected"
      ? statusIcons[status]
      : CircleAlert;

  return (
    <div className={styles.statusPanel} {...(status === "error" ? { role: "alert" as const } : {})}>
      <StatusIcon aria-hidden="true" strokeWidth={1.75} />
      <h3>{copy.title}</h3>
      <p>{copy.description}</p>
      {copy.action?.kind === "retry" ? (
        <button className={styles.statusAction} onClick={onRetry} type="button">
          {copy.action.label}
        </button>
      ) : null}
      {copy.action?.kind === "link" && copy.action.href ? (
        <Link className={styles.statusAction} href={copy.action.href}>
          {copy.action.label}
        </Link>
      ) : null}
    </div>
  );
}

"use client";

import { CalendarDays } from "lucide-react";
import { useEffect, useState } from "react";

import { StatusBadge } from "@/components/ui/status-badge";

import { loadBrowserGoogleCalendarStatus } from "../api/load-integrations";
import { GoogleCalendarConnect, type CalendarConnectionStatus } from "./google-calendar-connect";

import styles from "./integration-list.module.scss";

const CONNECTED_NOTE = "Календарь подключён. Доступ только на чтение.";

type GoogleCalendarCardProps = Readonly<{
  status?: CalendarConnectionStatus | null;
}>;

export function GoogleCalendarCard({ status = null }: GoogleCalendarCardProps) {
  const [connected, setConnected] = useState(status === "connected");

  useEffect(() => {
    if (status === "connected") {
      return;
    }

    const controller = new AbortController();
    let ignore = false;

    void loadBrowserGoogleCalendarStatus(fetch, controller.signal).then(
      (next) => {
        if (!ignore && next === "connected") {
          setConnected(true);
        }
      },
      () => undefined
    );

    return () => {
      ignore = true;
      controller.abort();
    };
  }, [status]);

  return (
    <li className={styles.card}>
      <div className={styles.cardHeader}>
        <div aria-hidden="true" className={styles.icon}>
          <CalendarDays strokeWidth={1.8} />
        </div>
        <StatusBadge tone={connected ? "success" : "neutral"}>
          {connected ? "Подключено" : "Не подключено"}
        </StatusBadge>
      </div>

      <div className={styles.cardCopy}>
        <h2>Google Calendar</h2>
        <p>События на сегодня и ближайшая встреча без возможности редактирования.</p>
      </div>

      <p className={styles.detail}>
        {connected
          ? "События читаются с сервера. Редактирование недоступно."
          : "Запрашивается отдельный read-only scope только после вашего действия."}
      </p>

      <div className={styles.cardFooter}>
        {connected ? (
          <span id="google-calendar-availability">{CONNECTED_NOTE}</span>
        ) : (
          <GoogleCalendarConnect status={status === "connected" ? null : status} />
        )}
      </div>
    </li>
  );
}

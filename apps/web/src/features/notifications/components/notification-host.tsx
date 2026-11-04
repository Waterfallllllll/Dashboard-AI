"use client";

import { useEffect, useSyncExternalStore } from "react";

import { formatInZone, getSystemTimeZone } from "@/lib/format/date-time";
import {
  getRoutineLibraryServerSnapshot,
  getRoutineLibrarySnapshot,
  subscribeRoutineLibrary
} from "@/features/routines";

import { listOnDate } from "@/features/routines";

import { publishProductNotice } from "../model/notification-center";
import {
  getNotificationServerSnapshot,
  getNotificationSnapshot,
  subscribeNotifications
} from "../model/notification-preferences-store";

import styles from "./notification-host.module.scss";

export function NotificationHost() {
  const notifications = useSyncExternalStore(
    subscribeNotifications,
    getNotificationSnapshot,
    getNotificationServerSnapshot
  );
  const library = useSyncExternalStore(
    subscribeRoutineLibrary,
    getRoutineLibrarySnapshot,
    getRoutineLibraryServerSnapshot
  );

  useEffect(() => {
    const timeZone = getSystemTimeZone();

    function remind() {
      const now = new Date();
      const today = formatInZone(now.getTime(), timeZone, "yyyy-MM-dd");
      const clock = formatInZone(now.getTime(), timeZone, "HH:mm");

      for (const item of listDueReminders(library.library, today, clock)) {
        publishProductNotice({
          key: `routine:${item.templateId}:${today}:${clock}`,
          title: item.title,
          body: "Подошло напоминание о рутине.",
          kind: "routine",
          now
        });
      }
    }

    remind();
    const intervalId = window.setInterval(remind, 30_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [library.library]);

  const notice = notifications.notice;

  return (
    <div aria-live="polite" className={styles.host}>
      {notice ? (
        <p>
          <strong>{notice.title}</strong> {notice.body}
        </p>
      ) : null}
    </div>
  );
}

function listDueReminders(library: Parameters<typeof listOnDate>[0], today: string, clock: string) {
  return listOnDate(library, today, today).flatMap((item) => {
    const template = library.templates.find((entry) => entry.id === item.templateId);

    if (!template || template.reminderTime !== clock || item.done) {
      return [];
    }

    return [item];
  });
}

import type {
  NotificationChannel,
  NotificationEvent,
  NotificationPreferences
} from "@dashboard/contracts";

import { localClockMinutes } from "../../shared/local-date.js";

export type DeliveryDecision = "send" | "disabled" | "quiet";

export function deliveryDecision(
  preferences: NotificationPreferences,
  eventType: NotificationEvent,
  channel: NotificationChannel,
  now: Date,
  timeZone: string
): DeliveryDecision {
  if (isQuietHours(preferences, now, timeZone)) {
    return "quiet";
  }

  const flags = preferences[eventType];
  const enabled = channel === "in_app" ? flags.browser || flags.telegram : flags[channel];
  return enabled ? "send" : "disabled";
}

export function isQuietHours(
  preferences: NotificationPreferences,
  now: Date,
  timeZone: string
): boolean {
  if (!preferences.quietStart || !preferences.quietEnd) {
    return false;
  }

  const current = localClockMinutes(now, timeZone);
  const start = minutesOf(preferences.quietStart);
  const end = minutesOf(preferences.quietEnd);

  if (start === end) {
    return false;
  }

  if (start < end) {
    return current >= start && current < end;
  }

  return current >= start || current < end;
}

export function notificationCopy(
  eventType: NotificationEvent,
  title: string | undefined
): { title: string; body: string; path: "/dashboard"; tag: string } {
  const cleanTitle = cleanText(title, 120);

  switch (eventType) {
    case "work":
      return {
        title: "Таймер",
        body: "Рабочий интервал завершён.",
        path: "/dashboard",
        tag: "timer-work"
      };
    case "break":
      return { title: "Таймер", body: "Перерыв завершён.", path: "/dashboard", tag: "timer-break" };
    case "routine":
      return {
        title: "Рутина",
        body: cleanTitle || "Пора выполнить дело.",
        path: "/dashboard",
        tag: "routine"
      };
    case "calendar":
      return {
        title: "Календарь",
        body: cleanTitle || "Скоро начнётся событие.",
        path: "/dashboard",
        tag: "calendar"
      };
  }
}

export function cleanText(value: string | undefined, maxLength: number): string {
  if (!value) {
    return "";
  }

  let result = "";

  for (const character of value) {
    const code = character.codePointAt(0) ?? 0;

    if (code === 9 || code === 10 || code === 13) {
      result += " ";
      continue;
    }

    if (code > 31 && code !== 127) {
      result += character;
    }
  }

  return result.replaceAll(/\s+/g, " ").trim().slice(0, maxLength);
}

function minutesOf(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}

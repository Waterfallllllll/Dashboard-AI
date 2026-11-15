import type { IntegrationSummary } from "@dashboard/contracts";

import { formatInZone, formatUpdatedAt } from "@/lib/format/date-time";

export type CalendarReturnStatus = "connected" | "cancelled" | "error";

const CALENDAR_MESSAGES: Readonly<Record<CalendarReturnStatus, string>> = {
  connected: "Календарь подключён. События появятся на дашборде после синхронизации.",
  cancelled: "Подключение календаря отменено.",
  error: "Не удалось подключить календарь. Повторите попытку позже."
};

export function parseCalendarReturn(
  rawStatus: string | string[] | undefined
): CalendarReturnStatus | null {
  const statusValue = Array.isArray(rawStatus) ? rawStatus[0] : rawStatus;

  if (statusValue === "connected" || statusValue === "cancelled" || statusValue === "error") {
    return statusValue;
  }

  return null;
}

export function calendarReturnMessage(status: CalendarReturnStatus | null): string | null {
  return status ? CALENDAR_MESSAGES[status] : null;
}

export function isAllowedIntegrationUrl(url: string, hosts: readonly string[]): boolean {
  try {
    const parsed = new URL(url);

    return (
      parsed.protocol === "https:" &&
      parsed.username === "" &&
      parsed.password === "" &&
      hosts.includes(parsed.hostname)
    );
  } catch {
    return false;
  }
}

export function remoteIntegration(
  id: string,
  remote: readonly IntegrationSummary[]
): IntegrationSummary | undefined {
  const type = id === "google-calendar" ? "google_calendar" : id === "telegram" ? "telegram" : null;

  if (!type) {
    return undefined;
  }

  return remote.find((item) => item.type === type);
}

export function integrationStatusLabel(
  status: IntegrationSummary["status"] | "checking"
): string {
  switch (status) {
    case "checking":
      return "Проверяем";
    case "connected":
      return "Подключено";
    case "revoked":
      return "Доступ отозван";
    case "disconnected":
      return "Не подключено";
  }
}

export function integrationStatusTone(
  status: IntegrationSummary["status"] | "checking"
): "neutral" | "success" | "warning" | "info" {
  switch (status) {
    case "checking":
      return "info";
    case "connected":
      return "success";
    case "revoked":
      return "warning";
    case "disconnected":
      return "neutral";
  }
}

export function syncSentence(
  lastSyncAt: string | null,
  timeZone: string,
  now = Date.now()
): string | null {
  if (!lastSyncAt) {
    return null;
  }

  const timestamp = Date.parse(lastSyncAt);

  if (Number.isNaN(timestamp)) {
    return null;
  }

  return `Последняя синхронизация ${formatUpdatedAt(timestamp, now, timeZone)}.`;
}

export function linkExpiryLabel(expiresAt: string, timeZone: string): string | null {
  const timestamp = Date.parse(expiresAt);

  if (Number.isNaN(timestamp)) {
    return null;
  }

  return formatInZone(timestamp, timeZone, "d MMM, HH:mm");
}

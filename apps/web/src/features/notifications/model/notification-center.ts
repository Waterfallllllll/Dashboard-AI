import {
  eventEnabled,
  isQuietTime,
  rememberNotificationKey,
  type NotificationEventKind
} from "./notification-preferences";
import {
  getNotificationPreferencesSnapshot,
  publishAppNotice
} from "./notification-preferences-store";

export type BrowserPermission = NotificationPermission | "unsupported";

export function readBrowserPermission(): BrowserPermission {
  if (typeof Notification === "undefined") {
    return "unsupported";
  }

  return Notification.permission;
}

export async function requestBrowserNotifications(): Promise<BrowserPermission> {
  if (typeof Notification === "undefined") {
    return "unsupported";
  }

  try {
    return await Notification.requestPermission();
  } catch {
    return "denied";
  }
}

export function publishProductNotice(input: {
  key: string;
  title: string;
  body: string;
  kind: NotificationEventKind;
  now?: Date;
}): boolean {
  const preferences = getNotificationPreferencesSnapshot();
  const now = input.now ?? new Date();

  if (!eventEnabled(input.kind, preferences)) {
    return false;
  }

  if (!rememberNotificationKey(input.key)) {
    return false;
  }

  const quiet = isQuietTime(now, preferences);
  publishAppNotice({
    key: input.key,
    title: input.title,
    body: quiet ? `${input.body} Тихие часы: звук и системное уведомление выключены.` : input.body
  });

  if (!quiet) {
    showBrowserNotification(input.title, input.body, input.key);
  }

  return true;
}

function showBrowserNotification(title: string, body: string, key: string): void {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") {
    return;
  }

  try {
    new Notification(title, { body, tag: key });
  } catch {
    // Системное уведомление необязательно: сообщение уже есть в интерфейсе.
  }
}

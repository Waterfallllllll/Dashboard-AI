import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  NOTIFICATION_PREFERENCES_STORAGE_KEY,
  parseNotificationPreferences,
  type NotificationPreferences
} from "./notification-preferences";

export const APP_NOTICE_VISIBLE_MS = 6_000;

export type AppNotice = Readonly<{
  key: string;
  title: string;
  body: string;
}>;

export type NotificationSnapshot = Readonly<{
  preferences: NotificationPreferences;
  notice: AppNotice | null;
}>;

const SERVER_SNAPSHOT: NotificationSnapshot = {
  preferences: DEFAULT_NOTIFICATION_PREFERENCES,
  notice: null
};

let snapshot: NotificationSnapshot = SERVER_SNAPSHOT;
let loaded = false;
let hideNoticeTimer: number | undefined;
const listeners = new Set<() => void>();

export function getNotificationPreferencesSnapshot(): NotificationPreferences {
  loadPreferences();
  return snapshot.preferences;
}

export function getNotificationSnapshot(): NotificationSnapshot {
  loadPreferences();
  return snapshot;
}

export function getNotificationServerSnapshot(): NotificationSnapshot {
  return SERVER_SNAPSHOT;
}

export function subscribeNotifications(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  window.addEventListener("storage", handleStorage);

  return () => {
    listeners.delete(onStoreChange);
    window.removeEventListener("storage", handleStorage);
  };
}

export function saveNotificationPreferences(preferences: NotificationPreferences): boolean {
  loadPreferences();

  try {
    window.localStorage.setItem(NOTIFICATION_PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    return false;
  }

  snapshot = {
    ...snapshot,
    preferences
  };
  emit();
  return true;
}

export function publishAppNotice(notice: AppNotice): void {
  loadPreferences();
  snapshot = {
    ...snapshot,
    notice
  };
  scheduleNoticeHide(notice.key);
  emit();
}

export function dismissAppNotice(key?: string): void {
  if (snapshot.notice === null || (key !== undefined && snapshot.notice.key !== key)) {
    return;
  }

  window.clearTimeout(hideNoticeTimer);
  hideNoticeTimer = undefined;
  snapshot = {
    ...snapshot,
    notice: null
  };
  emit();
}

export function resetNotificationStoreForTests(): void {
  window.clearTimeout(hideNoticeTimer);
  hideNoticeTimer = undefined;
  loaded = false;
  snapshot = SERVER_SNAPSHOT;
}

function loadPreferences(): void {
  if (loaded || typeof window === "undefined") {
    return;
  }

  loaded = true;
  snapshot = {
    preferences: readPreferences(),
    notice: null
  };
}

function readPreferences(): NotificationPreferences {
  try {
    return parseNotificationPreferences(
      window.localStorage.getItem(NOTIFICATION_PREFERENCES_STORAGE_KEY)
    );
  } catch {
    return DEFAULT_NOTIFICATION_PREFERENCES;
  }
}

function handleStorage(event: StorageEvent): void {
  if (event.key !== NOTIFICATION_PREFERENCES_STORAGE_KEY) {
    return;
  }

  snapshot = {
    ...snapshot,
    preferences: parseNotificationPreferences(event.newValue)
  };
  emit();
}

function scheduleNoticeHide(key: string): void {
  window.clearTimeout(hideNoticeTimer);
  hideNoticeTimer = window.setTimeout(() => {
    dismissAppNotice(key);
  }, APP_NOTICE_VISIBLE_MS);
}

function emit(): void {
  for (const listener of listeners) {
    listener();
  }
}

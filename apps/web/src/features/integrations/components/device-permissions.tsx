"use client";

import { useState, useSyncExternalStore } from "react";

import {
  getNotificationServerSnapshot,
  getNotificationSnapshot,
  requestBrowserNotifications,
  saveNotificationPreferences,
  subscribeNotifications,
  WebPushControls,
  type BrowserPermission
} from "@/features/notifications";

import styles from "./device-permissions.module.scss";

export function DevicePermissions() {
  const notifications = useSyncExternalStore(
    subscribeNotifications,
    getNotificationSnapshot,
    getNotificationServerSnapshot
  );
  const [permission, setPermission] = useState<BrowserPermission>("default");
  const preferences = notifications.preferences;

  async function enableNotifications() {
    const next = await requestBrowserNotifications();
    setPermission(next);
  }

  return (
    <section aria-labelledby="device-permissions-title" className={styles.section}>
      <header>
        <h2 id="device-permissions-title">Это устройство</h2>
        <p>Уведомления запрашиваются только после нажатия. Календарь и место настраиваются выше.</p>
      </header>

      <article className={styles.card}>
        <h3>Уведомления на этом устройстве</h3>
        <p>
          Разрешение браузера запрашивается только кнопкой ниже. Если браузер откажет, сообщения
          останутся в интерфейсе.
        </p>
        <button onClick={() => void enableNotifications()} type="button">
          Разрешить уведомления
        </button>
        <p role="status">{permissionMessage(permission)}</p>
        <WebPushControls />
        <fieldset>
          <legend>Какие события показывать</legend>
          <EventToggle
            checked={preferences.workComplete}
            label="Завершение рабочего интервала"
            onChange={(workComplete) => {
              saveNotificationPreferences({ ...preferences, workComplete });
            }}
          />
          <EventToggle
            checked={preferences.breakComplete}
            label="Завершение перерыва"
            onChange={(breakComplete) => {
              saveNotificationPreferences({ ...preferences, breakComplete });
            }}
          />
          <EventToggle
            checked={preferences.routineReminder}
            label="Напоминания о рутинах"
            onChange={(routineReminder) => {
              saveNotificationPreferences({ ...preferences, routineReminder });
            }}
          />
          <EventToggle
            checked={preferences.calendarReminder}
            label="Напоминание о ближайшем событии календаря"
            onChange={(calendarReminder) => {
              saveNotificationPreferences({ ...preferences, calendarReminder });
            }}
          />
        </fieldset>
        <p>Напоминание календаря включится после подключения Google Calendar.</p>
        <div className={styles.quiet}>
          <label>
            Тихие часы с
            <input
              onChange={(event) => {
                saveNotificationPreferences({
                  ...preferences,
                  quietStart: event.currentTarget.value || null
                });
              }}
              type="time"
              value={preferences.quietStart ?? ""}
            />
          </label>
          <label>
            до
            <input
              onChange={(event) => {
                saveNotificationPreferences({
                  ...preferences,
                  quietEnd: event.currentTarget.value || null
                });
              }}
              type="time"
              value={preferences.quietEnd ?? ""}
            />
          </label>
        </div>
      </article>
    </section>
  );
}

function EventToggle({
  checked,
  label,
  onChange
}: Readonly<{
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}>) {
  return (
    <label>
      <input
        checked={checked}
        onChange={(event) => {
          onChange(event.currentTarget.checked);
        }}
        type="checkbox"
      />
      {label}
    </label>
  );
}

function permissionMessage(permission: BrowserPermission): string {
  switch (permission) {
    case "granted":
      return "Браузер разрешил уведомления. При открытом приложении сообщение также остаётся на экране.";
    case "denied":
      return "Браузер запретил уведомления. Разрешите их в настройках сайта. Пока запрет действует, сообщения остаются на экране.";
    case "unsupported":
      return "Этот браузер не поддерживает системные уведомления. Сообщения останутся на экране.";
    case "default":
      return "Системное разрешение ещё не запрашивалось.";
  }
}

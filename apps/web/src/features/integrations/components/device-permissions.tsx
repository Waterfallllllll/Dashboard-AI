"use client";

import { useState, useSyncExternalStore } from "react";

import {
  getDeviceLocationServerSnapshot,
  getDeviceLocationSnapshot,
  locationFromCoordinates,
  locationLabel,
  parseCity,
  saveDeviceLocation,
  subscribeDeviceLocation
} from "@/features/location";
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
  const location = useSyncExternalStore(
    subscribeDeviceLocation,
    getDeviceLocationSnapshot,
    getDeviceLocationServerSnapshot
  );
  const notifications = useSyncExternalStore(
    subscribeNotifications,
    getNotificationSnapshot,
    getNotificationServerSnapshot
  );
  const [city, setCity] = useState("");
  const [locationMessage, setLocationMessage] = useState(
    "Геолокация не запрашивается, пока вы сами не нажмёте кнопку."
  );
  const [permission, setPermission] = useState<BrowserPermission>("default");
  const [saveError, setSaveError] = useState("");
  const place = locationLabel(location);

  async function detectPlace() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocationMessage("Этот браузер не отдаёт координаты. Укажите город вручную.");
      return;
    }

    setLocationMessage("Запрашиваем сокращённые координаты…");

    try {
      const position = await requestPosition();
      const next = locationFromCoordinates(position.coords.latitude, position.coords.longitude);

      if (!next || !saveDeviceLocation(next)) {
        setSaveError("Не удалось сохранить место на этом устройстве.");
        return;
      }

      setSaveError("");
      setLocationMessage(
        "Сохранили координаты с точностью около километра. Прогноз останется демонстрационным, пока не подключён API погоды."
      );
    } catch (error) {
      const denied =
        typeof error === "object" && error !== null && "code" in error && error.code === 1;
      setLocationMessage(
        denied
          ? "Браузер запретил доступ к месту. Укажите город вручную или разрешите геолокацию в настройках сайта."
          : "Не удалось определить место. Укажите город вручную."
      );
    }
  }

  function saveCity() {
    const nextCity = parseCity(city);

    if (!nextCity) {
      setLocationMessage("Введите город, не длиннее 80 символов.");
      return;
    }

    if (!saveDeviceLocation({ kind: "city", city: nextCity })) {
      setSaveError("Не удалось сохранить город на этом устройстве.");
      return;
    }

    setSaveError("");
    setCity("");
    setLocationMessage(
      `Город «${nextCity}» сохранён. Прогноз погоды останется демонстрационным до API.`
    );
  }

  async function enableNotifications() {
    const next = await requestBrowserNotifications();
    setPermission(next);
  }

  const preferences = notifications.preferences;

  return (
    <section aria-labelledby="device-permissions-title" className={styles.section}>
      <header>
        <h2 id="device-permissions-title">Это устройство</h2>
        <p>
          Место и уведомления запрашиваются только после нажатия. Календарь подключается отдельной кнопкой выше.
        </p>
      </header>

      <article className={styles.card}>
        <h3>Место для погоды</h3>
        <p>{place ? `Сейчас: ${place}` : "Город не задан, виджет показывает Москву."}</p>
        <p>{locationMessage}</p>
        <div className={styles.actions}>
          <button onClick={() => void detectPlace()} type="button">
            Определить место
          </button>
          <button
            onClick={() => {
              if (saveDeviceLocation(null)) {
                setSaveError("");
                setLocationMessage("Локация удалена. Виджет снова показывает Москву.");
              }
            }}
            type="button"
          >
            Удалить локацию
          </button>
        </div>
        <label>
          Город
          <input
            maxLength={80}
            onChange={(event) => {
              setCity(event.currentTarget.value);
            }}
            value={city}
          />
        </label>
        <button onClick={saveCity} type="button">
          Сохранить город
        </button>
      </article>

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
      {saveError ? <p role="alert">{saveError}</p> : null}
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

function requestPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      maximumAge: 300_000,
      timeout: 8_000
    });
  });
}

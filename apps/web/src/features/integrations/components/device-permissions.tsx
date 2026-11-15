"use client";

import {
  notificationPreferencesResponseSchema,
  weatherLocationResponseSchema,
  weatherPlacesResponseSchema
} from "@dashboard/contracts";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

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
  type BrowserPermission,
  type NotificationPreferences
} from "@/features/notifications";
import { browserApi } from "@/lib/api/browser-api-client";
import { getCsrfToken } from "@/lib/api/csrf-memory";

import { devicePreferencesFromApi } from "../model/device-preferences";

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
  const preferencesTouched = useRef(false);
  const place = locationLabel(location);

  useEffect(() => {
    if (!getCsrfToken()) {
      return;
    }

    let cancelled = false;

    void (async () => {
      const result = await browserApi({
        path: "/api/v1/notifications/preferences",
        schema: notificationPreferencesResponseSchema
      });

      if (!result.ok || cancelled || preferencesTouched.current) {
        return;
      }

      saveNotificationPreferences(devicePreferencesFromApi(result.data.data));
    })();

    return () => {
      cancelled = true;
    };
  }, []);

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

      if (next.kind === "coordinates" && getCsrfToken()) {
        setLocationMessage("Сохраняем место в аккаунте…");
        const saved = await syncCoordinates(
          next.latitude,
          next.longitude,
          `${next.latitude.toFixed(2)}, ${next.longitude.toFixed(2)}`
        );
        setLocationMessage(
          saved
            ? "Сохранили координаты с точностью около километра. Прогноз на дашборде возьмёт это место."
            : "Координаты сохранены на этом устройстве. Сервер место не принял."
        );
        return;
      }

      setLocationMessage("Сохранили координаты с точностью около километра на этом устройстве.");
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

    if (!getCsrfToken()) {
      setLocationMessage(`Город «${nextCity}» сохранён на этом устройстве.`);
      return;
    }

    setLocationMessage("Сохраняем город в аккаунте…");
    void syncCity(nextCity).then((saved) => {
      setLocationMessage(
        saved
          ? `Город «${nextCity}» сохранён в аккаунте.`
          : "Город сохранён на этом устройстве. Сервер не принял это название."
      );
    });
  }

  function updatePreferences(next: NotificationPreferences) {
    preferencesTouched.current = true;
    saveNotificationPreferences(next);
    void syncNotificationPreferences(next);
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
          Место и уведомления запрашиваются только после нажатия. При входе они сохраняются в аккаунте.
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
                void clearWeatherLocation();
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
            id="weather-city"
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
              updatePreferences({ ...preferences, workComplete });
            }}
          />
          <EventToggle
            checked={preferences.breakComplete}
            label="Завершение перерыва"
            onChange={(breakComplete) => {
              updatePreferences({ ...preferences, breakComplete });
            }}
          />
          <EventToggle
            checked={preferences.routineReminder}
            label="Напоминания о рутинах"
            onChange={(routineReminder) => {
              updatePreferences({ ...preferences, routineReminder });
            }}
          />
          <EventToggle
            checked={preferences.calendarReminder}
            label="Напоминание о ближайшем событии календаря"
            onChange={(calendarReminder) => {
              updatePreferences({ ...preferences, calendarReminder });
            }}
          />
        </fieldset>
        <p>Напоминание календаря включится после подключения Google Calendar.</p>
        <div className={styles.quiet}>
          <label>
            Тихие часы с
            <input
              onChange={(event) => {
                updatePreferences({
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
                updatePreferences({
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

async function syncCoordinates(latitude: number, longitude: number, label: string): Promise<boolean> {
  if (!getCsrfToken()) {
    return false;
  }

  const saved = await browserApi({
    path: "/api/v1/weather/location",
    method: "PUT",
    schema: weatherLocationResponseSchema,
    body: { latitude, longitude, label }
  });

  return saved.ok;
}

async function syncCity(city: string): Promise<boolean> {
  if (!getCsrfToken() || city.length < 2) {
    return false;
  }

  const places = await browserApi({
    path: "/api/v1/weather/places",
    schema: weatherPlacesResponseSchema,
    query: { query: city }
  });
  const place = places.ok ? places.data.data.places[0] : undefined;

  if (!place) {
    return false;
  }

  const saved = await browserApi({
    path: "/api/v1/weather/location",
    method: "PUT",
    schema: weatherLocationResponseSchema,
    body: place
  });

  return saved.ok;
}

async function clearWeatherLocation(): Promise<void> {
  if (!getCsrfToken()) {
    return;
  }

  await browserApi({
    path: "/api/v1/weather/location",
    method: "DELETE",
    schema: weatherLocationResponseSchema
  });
}

async function syncNotificationPreferences(preferences: NotificationPreferences): Promise<void> {
  if (!getCsrfToken()) {
    return;
  }

  const quietStart = clockTime(preferences.quietStart);
  const quietEnd = clockTime(preferences.quietEnd);
  const channel = (enabled: boolean) => ({ browser: enabled, telegram: enabled });

  await browserApi({
    path: "/api/v1/notifications/preferences",
    method: "PATCH",
    schema: notificationPreferencesResponseSchema,
    body: {
      work: channel(preferences.workComplete),
      break: channel(preferences.breakComplete),
      routine: channel(preferences.routineReminder),
      calendar: channel(preferences.calendarReminder),
      quietStart: quietStart && quietEnd ? quietStart : null,
      quietEnd: quietStart && quietEnd ? quietEnd : null
    }
  });
}

function clockTime(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const match = /^([01]\d|2[0-3]):[0-5]\d/.exec(value);
  return match?.[0] ?? null;
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

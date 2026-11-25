"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import type { WeatherPlace } from "@dashboard/contracts";

import {
  WeatherPlaceError,
  clearWeatherPlace,
  loadWeatherPlace,
  saveWeatherPlace,
  searchWeatherPlaces
} from "../api/weather-place";
import { locationFromCoordinates, parseCity } from "@/features/location";
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
  const [city, setCity] = useState("");
  const [cityInvalid, setCityInvalid] = useState(false);
  const [place, setPlace] = useState<WeatherPlace | null>(null);
  const [placeKnown, setPlaceKnown] = useState(false);
  const [busy, setBusy] = useState(false);
  const [locationMessage, setLocationMessage] = useState(
    "Геолокация не запрашивается, пока вы сами не нажмёте кнопку. Координаты сохраняются с точностью около километра."
  );
  const [permission, setPermission] = useState<BrowserPermission>("default");
  const [saveError, setSaveError] = useState("");
  const placeRequest = useRef(0);
  const cityInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const request = ++placeRequest.current;
    const controller = new AbortController();

    void loadWeatherPlace(fetch, controller.signal).then(
      (location) => {
        if (request !== placeRequest.current) {
          return;
        }

        setPlace(location);
        setPlaceKnown(true);
      },
      (error: unknown) => {
        if (request !== placeRequest.current || isAbortError(error)) {
          return;
        }

        setPlaceKnown(true);
        setLocationMessage(messageFrom(error, "Не удалось прочитать сохранённое место."));
      }
    );

    return () => {
      controller.abort();
    };
  }, []);

  async function detectPlace() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocationMessage("Этот браузер не отдаёт координаты. Укажите город вручную.");
      return;
    }

    setBusy(true);
    setSaveError("");
    setLocationMessage("Запрашиваем сокращённые координаты…");

    try {
      const position = await requestPosition();
      const next = locationFromCoordinates(position.coords.latitude, position.coords.longitude);

      if (!next || next.kind !== "coordinates") {
        setSaveError("Не удалось сохранить место.");
        return;
      }

      const saved = await rememberPlace({
        latitude: next.latitude,
        longitude: next.longitude,
        label: `${next.latitude.toFixed(2)}, ${next.longitude.toFixed(2)}`
      });
      setLocationMessage(
        `Место «${saved.label}» сохранено. Откройте дашборд, чтобы увидеть прогноз.`
      );
    } catch (error) {
      const denied =
        typeof error === "object" && error !== null && "code" in error && error.code === 1;
      setLocationMessage(
        denied
          ? "Браузер запретил доступ к месту. Укажите город вручную или разрешите геолокацию в настройках сайта."
          : messageFrom(error, "Не удалось определить место. Укажите город вручную.")
      );
    } finally {
      setBusy(false);
    }
  }

  async function saveCity() {
    const nextCity = parseCity(city);

    if (!nextCity || nextCity.length < 2) {
      setCityInvalid(true);
      setLocationMessage(
        nextCity ? "Введите хотя бы два символа." : "Введите город, не длиннее 80 символов."
      );
      cityInputRef.current?.focus();
      return;
    }

    setBusy(true);
    setSaveError("");

    try {
      const places = await searchWeatherPlaces(nextCity);
      const found = places[0];

      if (!found) {
        setCityInvalid(true);
        setLocationMessage("Такой город не найден. Проверьте написание.");
        cityInputRef.current?.focus();
        return;
      }

      const saved = await rememberPlace(found);
      setCity("");
      setCityInvalid(false);
      setLocationMessage(
        `Место «${saved.label}» сохранено. Откройте дашборд, чтобы увидеть прогноз.`
      );
    } catch (error) {
      setLocationMessage(messageFrom(error, "Не удалось сохранить город."));
    } finally {
      setBusy(false);
    }
  }

  async function removePlace() {
    setBusy(true);
    setSaveError("");

    try {
      placeRequest.current += 1;
      await clearWeatherPlace();
      setPlace(null);
      setPlaceKnown(true);
      setLocationMessage("Место удалено. Виджет погоды снова попросит указать город.");
    } catch (error) {
      setLocationMessage(messageFrom(error, "Не удалось удалить место."));
    } finally {
      setBusy(false);
    }
  }

  async function rememberPlace(next: WeatherPlace): Promise<WeatherPlace> {
    placeRequest.current += 1;
    const saved = await saveWeatherPlace(next);
    setPlace(saved);
    setPlaceKnown(true);
    setSaveError("");
    return saved;
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
        <form
          aria-labelledby="weather-place-title"
          className={styles.placeForm}
          onSubmit={(event) => {
            event.preventDefault();
            void saveCity();
          }}
        >
          <h3 id="weather-place-title">Место для погоды</h3>
          <p>
            {place
              ? `Сейчас: ${place.label}`
              : placeKnown
                ? "Место не задано. Виджет погоды ждёт город или геолокацию."
                : "Проверяем сохранённое место…"}
          </p>
          <p id="weather-place-status" role="status">
            {locationMessage}
          </p>
          <div className={styles.actions}>
            <button disabled={busy} onClick={() => void detectPlace()} type="button">
              Определить место
            </button>
            <button disabled={busy || !place} onClick={() => void removePlace()} type="button">
              Удалить локацию
            </button>
          </div>
          <label htmlFor="weather-city">Город</label>
          <input
            aria-describedby="weather-place-status"
            aria-invalid={cityInvalid}
            autoComplete="address-level2"
            disabled={busy}
            enterKeyHint="done"
            id="weather-city"
            maxLength={80}
            name="city"
            onChange={(event) => {
              setCity(event.currentTarget.value);
              setCityInvalid(false);
            }}
            ref={cityInputRef}
            value={city}
          />
          <button disabled={busy} type="submit">
            Сохранить город
          </button>
        </form>
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

function messageFrom(error: unknown, fallback: string): string {
  return error instanceof WeatherPlaceError ? error.message : fallback;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
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

"use client";

import { useEffect, useRef, useState } from "react";

import type { WeatherPlace } from "@dashboard/contracts";

import { locationFromCoordinates, parseCity } from "@/features/location";

import {
  WeatherPlaceError,
  clearWeatherPlace,
  loadWeatherPlace,
  saveWeatherPlace,
  searchWeatherPlaces
} from "../api/weather-place";

import styles from "./weather-place-form.module.scss";

type WeatherPlaceFormProps = Readonly<{
  onPlaceChange?: (place: WeatherPlace | null) => void;
}>;

export function WeatherPlaceForm({ onPlaceChange }: WeatherPlaceFormProps) {
  const [city, setCity] = useState("");
  const [cityInvalid, setCityInvalid] = useState(false);
  const [place, setPlace] = useState<WeatherPlace | null>(null);
  const [placeKnown, setPlaceKnown] = useState(false);
  const [busy, setBusy] = useState(false);
  const [locationMessage, setLocationMessage] = useState(
    "Геолокация не запрашивается, пока вы сами не нажмёте кнопку. Координаты сохраняются с точностью около километра."
  );
  const [saveError, setSaveError] = useState("");
  const placeRequest = useRef(0);
  const cityInputRef = useRef<HTMLInputElement>(null);
  const onPlaceChangeRef = useRef(onPlaceChange);
  const statusOwnedByUser = useRef(false);

  function publish(next: WeatherPlace | null): void {
    setPlace(next);
    setPlaceKnown(true);
    onPlaceChangeRef.current?.(next);
  }

  useEffect(() => {
    onPlaceChangeRef.current = onPlaceChange;
  }, [onPlaceChange]);

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
        onPlaceChangeRef.current?.(location);
      },
      (error: unknown) => {
        if (request !== placeRequest.current || isAbortError(error)) {
          return;
        }

        setPlace(null);
        setPlaceKnown(true);
        onPlaceChangeRef.current?.(null);

        if (!statusOwnedByUser.current) {
          setLocationMessage(messageFrom(error, "Не удалось прочитать сохранённое место."));
        }
      }
    );

    return () => {
      controller.abort();
    };
  }, []);

  async function detectPlace() {
    statusOwnedByUser.current = true;

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocationMessage(COORDINATES_UNAVAILABLE_MESSAGE);
      return;
    }

    setBusy(true);
    setSaveError("");
    setLocationMessage("Запрашиваем сокращённые координаты…");

    let position: GeolocationPosition;

    try {
      position = await requestPosition();
    } catch (error) {
      setLocationMessage(geolocationFailureMessage(error));
      setBusy(false);
      return;
    }

    try {
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
      setLocationMessage(messageFrom(error, "Не удалось определить место. Укажите город вручную."));
    } finally {
      setBusy(false);
    }
  }

  async function saveCity() {
    statusOwnedByUser.current = true;
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
    statusOwnedByUser.current = true;
    setBusy(true);
    setSaveError("");

    try {
      placeRequest.current += 1;
      await clearWeatherPlace();
      publish(null);
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
    publish(saved);
    setSaveError("");
    return saved;
  }

  return (
    <form
      aria-labelledby="location-title"
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault();
        void saveCity();
      }}
    >
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
      {saveError ? <p role="alert">{saveError}</p> : null}
    </form>
  );
}

function messageFrom(error: unknown, fallback: string): string {
  return error instanceof WeatherPlaceError ? error.message : fallback;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

const COORDINATES_UNAVAILABLE_MESSAGE =
  "Этот браузер не отдаёт координаты. Укажите город вручную.";
const GEOLOCATION_WAIT_MS = 8_000;

function geolocationFailureMessage(error: unknown): string {
  return readGeolocationCode(error) === 1
    ? "Браузер запретил доступ к месту. Укажите город вручную или разрешите геолокацию в настройках сайта."
    : COORDINATES_UNAVAILABLE_MESSAGE;
}

function readGeolocationCode(error: unknown): number | null {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return null;
  }

  return typeof error.code === "number" ? error.code : null;
}

function requestPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = window.setTimeout(() => {
      if (settled) {
        return;
      }

      settled = true;
      reject({ code: 3 });
    }, GEOLOCATION_WAIT_MS);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (settled) {
          return;
        }

        settled = true;
        window.clearTimeout(timer);
        resolve(position);
      },
      (error) => {
        if (settled) {
          return;
        }

        settled = true;
        window.clearTimeout(timer);
        reject(error);
      },
      {
        enableHighAccuracy: false,
        maximumAge: 300_000,
        timeout: GEOLOCATION_WAIT_MS
      }
    );
  });
}

"use client";

import { Clock3, Globe2, LogOut, ShieldAlert, UserRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

import { StatusBadge } from "@/components/ui/status-badge";
import { ThemeControl } from "@/components/ui/theme-control";

import styles from "./profile-settings.module.scss";

const STORAGE_KEY = "evergreen-profile-preferences";

const timezoneValues = [
  "auto",
  "Europe/Kaliningrad",
  "Europe/Moscow",
  "Europe/Samara",
  "Asia/Yekaterinburg",
  "Asia/Novosibirsk",
  "Asia/Vladivostok"
] as const;

type TimezoneValue = (typeof timezoneValues)[number];
type TimeFormat = "12" | "24";

type StoredPreferences = Readonly<{
  timezone: TimezoneValue;
  timeFormat: TimeFormat;
}>;

function isTimezoneValue(value: unknown): value is TimezoneValue {
  return typeof value === "string" && timezoneValues.some((timezone) => timezone === value);
}

function readStoredPreferences(): StoredPreferences | null {
  try {
    const rawValue = window.localStorage.getItem(STORAGE_KEY);
    const parsedValue: unknown = rawValue ? JSON.parse(rawValue) : null;

    if (
      typeof parsedValue === "object" &&
      parsedValue !== null &&
      "timezone" in parsedValue &&
      "timeFormat" in parsedValue &&
      isTimezoneValue(parsedValue.timezone) &&
      (parsedValue.timeFormat === "12" || parsedValue.timeFormat === "24")
    ) {
      return {
        timezone: parsedValue.timezone,
        timeFormat: parsedValue.timeFormat
      };
    }
  } catch {
    return null;
  }

  return null;
}

export function ProfileSettings() {
  const formRef = useRef<HTMLFormElement>(null);
  const [saveStatus, setSaveStatus] = useState("");

  useEffect(() => {
    const preferences = readStoredPreferences();

    if (!preferences || !formRef.current) {
      return;
    }

    const timezoneControl = formRef.current.elements.namedItem("timezone");
    const timeFormatControl = formRef.current.querySelector<HTMLInputElement>(
      `input[name="timeFormat"][value="${preferences.timeFormat}"]`
    );

    if (timezoneControl instanceof HTMLSelectElement) {
      timezoneControl.value = preferences.timezone;
    }

    if (timeFormatControl) {
      timeFormatControl.checked = true;
    }
  }, []);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const timezone = formData.get("timezone");
    const timeFormat = formData.get("timeFormat");

    if (!isTimezoneValue(timezone) || (timeFormat !== "12" && timeFormat !== "24")) {
      setSaveStatus("Проверьте выбранные значения.");
      return;
    }

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ timezone, timeFormat }));
      setSaveStatus("Предпочтения сохранены в этом браузере.");
    } catch {
      setSaveStatus("Браузер запретил локальное сохранение настроек.");
    }
  }

  return (
    <div className={styles.settings}>
      <section aria-labelledby="account-heading" className={styles.accountCard}>
        <div aria-hidden="true" className={styles.avatar}>
          <UserRound />
        </div>
        <div className={styles.accountCopy}>
          <h2 id="account-heading">Аккаунт Google</h2>
          <p>Имя и аватар появятся после безопасного входа.</p>
        </div>
        <StatusBadge tone="warning">Не авторизован</StatusBadge>
      </section>

      <form className={styles.form} onSubmit={handleSubmit} ref={formRef}>
        <section aria-labelledby="preferences-heading" className={styles.section}>
          <div className={styles.sectionHeading}>
            <div aria-hidden="true" className={styles.sectionIcon}>
              <Globe2 />
            </div>
            <div>
              <h2 id="preferences-heading">Локальные предпочтения</h2>
              <p>Эти параметры пока сохраняются только в текущем браузере.</p>
            </div>
          </div>

          <div className={styles.fields}>
            <div className={styles.field}>
              <label htmlFor="timezone">Часовой пояс</label>
              <select defaultValue="auto" id="timezone" name="timezone">
                <option value="auto">Автоматически по настройке браузера</option>
                <option value="Europe/Kaliningrad">Калининград (UTC+2)</option>
                <option value="Europe/Moscow">Москва (UTC+3)</option>
                <option value="Europe/Samara">Самара (UTC+4)</option>
                <option value="Asia/Yekaterinburg">Екатеринбург (UTC+5)</option>
                <option value="Asia/Novosibirsk">Новосибирск (UTC+7)</option>
                <option value="Asia/Vladivostok">Владивосток (UTC+10)</option>
              </select>
              <p>Смена часового пояса не переносит рутины на соседнюю дату.</p>
            </div>

            <fieldset className={styles.radioGroup}>
              <legend>
                <Clock3 aria-hidden="true" />
                Формат времени
              </legend>
              <label>
                <input defaultChecked name="timeFormat" type="radio" value="24" />
                <span>24 часа</span>
              </label>
              <label>
                <input name="timeFormat" type="radio" value="12" />
                <span>12 часов</span>
              </label>
            </fieldset>

            <ThemeControl />
          </div>

          <div className={styles.formFooter}>
            <p aria-live="polite" className={styles.saveStatus}>
              {saveStatus}
            </p>
            <button className={styles.primaryButton} type="submit">
              Сохранить предпочтения
            </button>
          </div>
        </section>
      </form>

      <section aria-labelledby="session-heading" className={styles.section}>
        <div className={styles.sectionHeading}>
          <div aria-hidden="true" className={styles.sectionIcon}>
            <LogOut />
          </div>
          <div>
            <h2 id="session-heading">Сессия</h2>
            <p>Управление активным входом появится после подключения backend-сессий.</p>
          </div>
        </div>
        <button className={styles.secondaryButton} disabled type="button">
          Выйти
        </button>
      </section>

      <section aria-labelledby="danger-heading" className={styles.dangerSection}>
        <div className={styles.sectionHeading}>
          <div aria-hidden="true" className={styles.dangerIcon}>
            <ShieldAlert />
          </div>
          <div>
            <h2 id="danger-heading">Удаление аккаунта</h2>
            <p>Удаляет профиль, интеграции, историю и отложенные задачи без восстановления.</p>
          </div>
        </div>
        <button className={styles.dangerButton} disabled type="button">
          Удалить аккаунт
        </button>
      </section>
    </div>
  );
}

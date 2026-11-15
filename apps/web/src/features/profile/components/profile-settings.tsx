"use client";

import {
  accountDeletionResponseSchema,
  profileResponseSchema,
  signOutResponseSchema
} from "@dashboard/contracts";
import { Clock3, Globe2, LogOut, ShieldAlert, UserRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

import { StatusBadge } from "@/components/ui/status-badge";
import { ThemeControl } from "@/components/ui/theme-control";
import { useSession } from "@/features/session";
import { browserApi } from "@/lib/api/browser-api-client";
import { getSystemTimeZone } from "@/lib/format/date-time";

import {
  PROFILE_PREFERENCES_STORAGE_KEY,
  isTimezoneValue,
  parseStoredPreferences
} from "../model/profile-preferences";

import styles from "./profile-settings.module.scss";

export function ProfileSettings() {
  const session = useSession();
  const formRef = useRef<HTMLFormElement>(null);
  const [saveStatus, setSaveStatus] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    let rawValue: string | null;

    try {
      rawValue = window.localStorage.getItem(PROFILE_PREFERENCES_STORAGE_KEY);
    } catch {
      return;
    }

    const preferences = session
      ? {
          timezone: isTimezoneValue(session.user.timezone) ? session.user.timezone : "auto",
          timeFormat: session.user.timeFormat
        }
      : parseStoredPreferences(rawValue);

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
  }, [session]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const timezone = formData.get("timezone");
    const timeFormat = formData.get("timeFormat");

    if (!isTimezoneValue(timezone) || (timeFormat !== "12" && timeFormat !== "24")) {
      setSaveStatus("Проверьте выбранные значения.");
      return;
    }

    try {
      window.localStorage.setItem(
        PROFILE_PREFERENCES_STORAGE_KEY,
        JSON.stringify({ timezone, timeFormat })
      );
      setSaveStatus(
        session ? "Сохраняем предпочтения в аккаунте…" : "Предпочтения сохранены в этом браузере."
      );
    } catch {
      setSaveStatus("Браузер запретил локальное сохранение настроек.");
      return;
    }

    if (!session) {
      return;
    }

    const themeControl = event.currentTarget.querySelector("#theme-preference");
    const theme =
      themeControl instanceof HTMLSelectElement &&
      (themeControl.value === "system" || themeControl.value === "light" || themeControl.value === "dark")
        ? themeControl.value
        : "system";
    const result = await browserApi({
      path: "/api/v1/profile",
      method: "PATCH",
      schema: profileResponseSchema,
      body: {
        timeFormat,
        theme,
        timezone: timezone === "auto" ? getSystemTimeZone() : timezone
      }
    });
    setSaveStatus(result.ok ? "Предпочтения сохранены в аккаунте." : result.message);
  }

  return (
    <div className={styles.settings}>
      <section aria-labelledby="account-heading" className={styles.accountCard}>
        <div aria-hidden="true" className={styles.avatar}>
          <UserRound />
        </div>
        <div className={styles.accountCopy}>
          <h2 id="account-heading">Аккаунт Google</h2>
          <p>
            {session
              ? session.user.displayName
              : "Имя и аватар появятся после безопасного входа."}
          </p>
        </div>
        <StatusBadge tone={session ? "success" : "warning"}>
          {session ? "Авторизован" : "Не авторизован"}
        </StatusBadge>
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
            <p>
              {session
                ? "Выход завершает только эту сессию."
                : "Управление активным входом появится после подключения backend-сессий."}
            </p>
          </div>
        </div>
        <button
          className={styles.secondaryButton}
          disabled={!session}
          onClick={() => {
            void signOut();
          }}
          type="button"
        >
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
        <button
          className={styles.dangerButton}
          disabled={!session}
          onClick={() => {
            if (!confirmDelete) {
              setConfirmDelete(true);
              return;
            }

            void deleteAccount();
          }}
          type="button"
        >
          {confirmDelete ? "Подтвердить удаление" : "Удалить аккаунт"}
        </button>
      </section>
    </div>
  );
}

async function signOut(): Promise<void> {
  const result = await browserApi({
    path: "/api/v1/auth/logout",
    method: "POST",
    schema: signOutResponseSchema
  });

  if (result.ok) {
    leaveSession();
  }
}

async function deleteAccount(): Promise<void> {
  const result = await browserApi({
    path: "/api/v1/account",
    method: "DELETE",
    schema: accountDeletionResponseSchema
  });

  if (result.ok) {
    leaveSession();
  }
}

function leaveSession(): void {
  // Полная загрузка сбрасывает кэш RSC и CSRF в памяти после удаления cookie.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- сессия уже уничтожена
  window.location.assign("/login");
}

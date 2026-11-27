"use client";

import { Clock3, Globe2, LogOut, ShieldAlert, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import type { FormEvent } from "react";

import { StatusBadge } from "@/components/ui/status-badge";
import { ThemeControl } from "@/components/ui/theme-control";

import {
  deleteAccount,
  loadAccountSession,
  signOutAccount,
  type AccountView
} from "../api/account-session";
import {
  PROFILE_PREFERENCES_STORAGE_KEY,
  isTimezoneValue,
  parseStoredPreferences
} from "../model/profile-preferences";

import styles from "./profile-settings.module.scss";

type AccountState = AccountView | { readonly status: "loading" } | { readonly status: "error" };

type ProfileSettingsProps = Readonly<{
  loadSession?: typeof loadAccountSession;
  signOut?: typeof signOutAccount;
  removeAccount?: typeof deleteAccount;
  onSignedOut?: () => void;
  onAccountDeleted?: () => void;
}>;

const accountCopy: Readonly<Record<AccountState["status"], string>> = {
  loading: "Проверяем текущий вход.",
  anonymous: "Имя и аватар появятся после входа через Google.",
  authenticated: "Вход через Google выполнен.",
  error: "Не удалось проверить сессию."
};

export function ProfileSettings({
  loadSession = loadAccountSession,
  signOut = signOutAccount,
  removeAccount = deleteAccount,
  onSignedOut,
  onAccountDeleted
}: ProfileSettingsProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const deleteDialogRef = useRef<HTMLDialogElement>(null);
  const deletingRef = useRef(false);
  const deleteTitleId = useId();
  const deleteDescriptionId = useId();
  const [saveStatus, setSaveStatus] = useState("");
  const [account, setAccount] = useState<AccountState>({ status: "loading" });
  const [signingOut, setSigningOut] = useState(false);
  const [sessionNotice, setSessionNotice] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteNotice, setDeleteNotice] = useState("");

  useEffect(() => {
    let ignore = false;
    const controller = new AbortController();

    loadSession(fetch, controller.signal).then(
      (nextAccount) => {
        if (!ignore) {
          setAccount(nextAccount);
        }
      },
      (error: unknown) => {
        if (!ignore && !(error instanceof Error && error.name === "AbortError")) {
          setAccount({ status: "error" });
        }
      }
    );

    return () => {
      ignore = true;
      controller.abort();
    };
  }, [loadSession]);

  useEffect(() => {
    let rawValue: string | null;

    try {
      rawValue = window.localStorage.getItem(PROFILE_PREFERENCES_STORAGE_KEY);
    } catch {
      return;
    }

    const preferences = parseStoredPreferences(rawValue);

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
      window.localStorage.setItem(
        PROFILE_PREFERENCES_STORAGE_KEY,
        JSON.stringify({ timezone, timeFormat })
      );
      setSaveStatus("Предпочтения сохранены в этом браузере.");
    } catch {
      setSaveStatus("Браузер запретил локальное сохранение настроек.");
    }
  }

  async function handleSignOut(): Promise<void> {
    if (account.status !== "authenticated") {
      return;
    }

    setSigningOut(true);
    setSessionNotice("");

    try {
      await signOut(account.csrfToken);
      setAccount({ status: "anonymous" });

      if (onSignedOut) {
        onSignedOut();
      } else {
        router.push("/login");
        router.refresh();
      }
    } catch {
      setSessionNotice("Не удалось выйти. Повторите попытку.");
    } finally {
      setSigningOut(false);
    }
  }

  useEffect(() => {
    const dialog = deleteDialogRef.current;

    if (!dialog || !confirmingDelete) {
      return;
    }

    if (!dialog.open) {
      openModal(dialog);
    }

    return attachLightDismiss(dialog);
  }, [confirmingDelete]);

  async function handleDelete(): Promise<void> {
    if (account.status !== "authenticated" || deletingRef.current) {
      return;
    }

    deletingRef.current = true;
    setDeleting(true);
    setDeleteNotice("");

    try {
      await removeAccount(account.csrfToken);
      setAccount({ status: "anonymous" });
      const dialog = deleteDialogRef.current;

      if (dialog) {
        closeModal(dialog);
      }

      if (onAccountDeleted) {
        onAccountDeleted();
      } else {
        router.push("/login");
        router.refresh();
      }
    } catch {
      setDeleteNotice("Не удалось удалить аккаунт. Повторите попытку.");
    } finally {
      deletingRef.current = false;
      setDeleting(false);
    }
  }

  const signedIn = account.status === "authenticated";
  const heading = signedIn ? account.displayName : "Аккаунт Google";

  return (
    <div className={styles.settings}>
      <section
        aria-busy={account.status === "loading"}
        aria-labelledby="account-heading"
        className={styles.accountCard}
      >
        <div aria-hidden="true" className={styles.avatar}>
          <AccountAvatar
            key={signedIn ? (account.avatarUrl ?? "none") : "guest"}
            url={signedIn ? account.avatarUrl : null}
          />
        </div>
        <div className={styles.accountCopy}>
          <h2 id="account-heading">{heading}</h2>
          <p>{accountCopy[account.status]}</p>
        </div>
        <AccountStatus account={account} />
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
              {signedIn
                ? "Можно завершить вход на этом устройстве."
                : "Войдите через Google, чтобы управлять входом."}
            </p>
            {sessionNotice ? (
              <p aria-live="polite" className={styles.saveStatus}>
                {sessionNotice}
              </p>
            ) : null}
          </div>
        </div>
        <div className={styles.sessionActions}>
          {account.status === "anonymous" ? (
            <a className={styles.secondaryButton} href="/api/v1/auth/google">
              Войти через Google
            </a>
          ) : null}
          <button
            className={styles.secondaryButton}
            disabled={!signedIn || signingOut}
            onClick={() => {
              void handleSignOut();
            }}
            type="button"
          >
            {signingOut ? "Выходим…" : "Выйти"}
          </button>
        </div>
      </section>

      <section aria-labelledby="danger-heading" className={styles.dangerSection}>
        <div className={styles.sectionHeading}>
          <div aria-hidden="true" className={styles.dangerIcon}>
            <ShieldAlert />
          </div>
          <div>
            <h2 id="danger-heading">Удаление аккаунта</h2>
            <p>Удаляет профиль, интеграции, историю и отложенные задачи без восстановления.</p>
            {deleteNotice && !confirmingDelete ? (
              <p aria-live="polite" className={styles.saveStatus}>
                {deleteNotice}
              </p>
            ) : null}
          </div>
        </div>
        <button
          className={styles.dangerButton}
          disabled={!signedIn || signingOut || deleting}
          onClick={() => {
            setDeleteNotice("");
            setConfirmingDelete(true);
          }}
          type="button"
        >
          Удалить аккаунт
        </button>
      </section>
      {confirmingDelete ? (
        <dialog
          aria-describedby={deleteDescriptionId}
          aria-labelledby={deleteTitleId}
          className={styles.dialog}
          closedby="any"
          onClose={() => {
            setConfirmingDelete(false);
          }}
          ref={deleteDialogRef}
        >
          <h1 id={deleteTitleId}>Удалить аккаунт?</h1>
          <p id={deleteDescriptionId}>
            Профиль, интеграции, история и отложенные задачи исчезнут без восстановления.
          </p>
          {deleteNotice ? (
            <p aria-live="assertive" className={styles.saveStatus}>
              {deleteNotice}
            </p>
          ) : null}
          <form className={styles.dialogActions} method="dialog">
            <button
              autoFocus
              className={styles.secondaryButton}
              disabled={deleting}
              onClick={() => {
                const dialog = deleteDialogRef.current;

                if (dialog) {
                  closeModal(dialog);
                }
              }}
              type="submit"
              value="cancel"
            >
              Отмена
            </button>
            <button
              className={styles.dangerButton}
              disabled={deleting}
              onClick={() => {
                void handleDelete();
              }}
              type="button"
            >
              {deleting ? "Удаляем…" : "Удалить аккаунт"}
            </button>
          </form>
        </dialog>
      ) : null}
    </div>
  );
}

function openModal(dialog: HTMLDialogElement): void {
  if (typeof dialog.showModal === "function") {
    dialog.showModal();
    return;
  }

  dialog.setAttribute("open", "");
}

function closeModal(dialog: HTMLDialogElement): void {
  if (typeof dialog.close === "function") {
    dialog.close();
    return;
  }

  dialog.removeAttribute("open");
  dialog.dispatchEvent(new Event("close"));
}

function attachLightDismiss(dialog: HTMLDialogElement): () => void {
  if ("closedBy" in HTMLDialogElement.prototype) {
    return () => undefined;
  }

  let pressedOutside = false;

  const outside = (event: PointerEvent): boolean => {
    const rect = dialog.getBoundingClientRect();
    return (
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom
    );
  };

  const onPointerDown = (event: PointerEvent): void => {
    pressedOutside = outside(event);
  };

  const onPointerUp = (event: PointerEvent): void => {
    if (pressedOutside && outside(event)) {
      closeModal(dialog);
    }

    pressedOutside = false;
  };

  dialog.addEventListener("pointerdown", onPointerDown);
  dialog.addEventListener("pointerup", onPointerUp);

  return () => {
    dialog.removeEventListener("pointerdown", onPointerDown);
    dialog.removeEventListener("pointerup", onPointerUp);
  };
}

function AccountStatus({ account }: Readonly<{ account: AccountState }>) {
  if (account.status === "authenticated") {
    return <StatusBadge tone="success">Авторизован</StatusBadge>;
  }

  if (account.status === "loading") {
    return <StatusBadge tone="info">Проверяем</StatusBadge>;
  }

  if (account.status === "error") {
    return <StatusBadge tone="error">Нет связи</StatusBadge>;
  }

  return <StatusBadge tone="warning">Не авторизован</StatusBadge>;
}

function AccountAvatar({ url }: Readonly<{ url: string | null }>) {
  const [failed, setFailed] = useState(false);

  if (!url || failed) {
    return <UserRound />;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- адрес аватара задаёт Google и может быть любым https-хостом
    <img
      alt=""
      height={48}
      onError={() => {
        setFailed(true);
      }}
      referrerPolicy="no-referrer"
      src={url}
      width={48}
    />
  );
}

"use client";

import { BellRing } from "lucide-react";
import { useEffect, useState } from "react";

import { StatusBadge } from "@/components/ui/status-badge";
import {
  requestBrowserNotifications,
  decodeVapidPublicKey,
  readWebPushPublicKey,
  registerAppServiceWorker
} from "@/features/notifications";

import {
  BrowserPushError,
  revokeBrowserPushSubscription,
  saveBrowserPushSubscription
} from "../api/browser-push";

import styles from "./integration-list.module.scss";

type PushPhase = "checking" | "off" | "on" | "unsupported";

type BrowserNotificationsCardProps = Readonly<{
  publicKey?: string;
}>;

export function BrowserNotificationsCard({ publicKey }: BrowserNotificationsCardProps) {
  const configuredKey = publicKey?.trim() || readWebPushPublicKey();
  const hasKey = decodeVapidPublicKey(configuredKey) !== null;
  const [phase, setPhase] = useState<PushPhase>("checking");
  const [pending, setPending] = useState(false);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [notice, setNotice] = useState("Разрешение запрашивается только этой кнопкой.");
  const [subscriptionId, setSubscriptionId] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;

    void readExistingSubscription(hasKey).then((next) => {
      if (ignore) {
        return;
      }

      setPhase(next.phase);
      setNotice(next.notice);
    });

    return () => {
      ignore = true;
    };
  }, [hasKey]);

  async function enable(): Promise<void> {
    const keyBytes = decodeVapidPublicKey(configuredKey);

    if (!keyBytes) {
      setNotice("Публичный ключ Web Push не задан.");
      return;
    }

    setPending(true);
    setNeedsLogin(false);

    const permission = await requestBrowserNotifications();

    if (permission !== "granted") {
      setPending(false);
      setNotice(
        permission === "denied"
          ? "Браузер запретил уведомления. Разрешите их в настройках сайта."
          : "Этот браузер не принимает уведомления. Сообщения останутся в интерфейсе."
      );
      return;
    }

    const registration = await registerAppServiceWorker();
    const subscription = await subscribe(registration, keyBytes);

    if (!subscription) {
      setPending(false);
      setNotice("Не удалось включить уведомления. Обновите страницу и попробуйте снова.");
      return;
    }

    const json = subscription.toJSON();
    const endpoint = json.endpoint;
    const p256dh = json.keys?.p256dh;
    const auth = json.keys?.auth;

    if (!endpoint || !p256dh || !auth) {
      setPending(false);
      setNotice("Не удалось прочитать подписку браузера.");
      return;
    }

    try {
      setSubscriptionId(await saveBrowserPushSubscription({ endpoint, keys: { p256dh, auth } }));
      setPhase("on");
      setNotice("Уведомления включены. Они приходят, даже если вкладка закрыта.");
    } catch (error) {
      setNeedsLogin(error instanceof BrowserPushError && error.code === "unauthenticated");
      setNotice(
        error instanceof BrowserPushError
          ? error.message
          : "Не удалось сохранить уведомления браузера."
      );
    } finally {
      setPending(false);
    }
  }

  async function disable(): Promise<void> {
    setPending(true);
    setNeedsLogin(false);

    try {
      const registration = await navigator.serviceWorker.getRegistration("/");
      const existing = await registration?.pushManager.getSubscription();
      await existing?.unsubscribe();

      if (subscriptionId) {
        await revokeBrowserPushSubscription(subscriptionId);
      }

      setSubscriptionId(null);
      setPhase("off");
      setNotice("Уведомления браузера выключены на этом устройстве.");
    } catch (error) {
      setNeedsLogin(error instanceof BrowserPushError && error.code === "unauthenticated");
      setNotice(
        error instanceof BrowserPushError
          ? error.message
          : "Не удалось выключить уведомления браузера."
      );
    } finally {
      setPending(false);
    }
  }

  const enabled = phase === "on";
  const canToggle = phase === "off" || phase === "on";

  return (
    <li className={styles.card}>
      <div className={styles.cardHeader}>
        <div aria-hidden="true" className={styles.icon}>
          <BellRing strokeWidth={1.8} />
        </div>
        <StatusBadge tone={enabled ? "success" : "warning"}>
          {enabled ? "Включены" : "Выключены"}
        </StatusBadge>
      </div>

      <div className={styles.cardCopy}>
        <h2>Уведомления браузера</h2>
        <p>Web Push сообщает о завершении рабочего интервала, даже если вкладка закрыта.</p>
      </div>

      <p className={styles.detail}>
        При отказе приложение продолжит показывать уведомления внутри интерфейса.
      </p>

      <div className={styles.cardFooter}>
        <button
          aria-describedby="browser-notifications-availability"
          disabled={!canToggle || pending || !hasKey}
          onClick={() => {
            void (enabled ? disable() : enable());
          }}
          type="button"
        >
          {pending ? "Сохраняем…" : enabled ? "Выключить уведомления" : "Включить уведомления"}
        </button>
        <span id="browser-notifications-availability">
          {notice}
          {needsLogin ? (
            <>
              {" "}
              <a href="/api/v1/auth/google">Войти через Google</a>
            </>
          ) : null}
        </span>
      </div>
    </li>
  );
}

async function readExistingSubscription(hasKey: boolean): Promise<{
  phase: PushPhase;
  notice: string;
}> {
  if (!canUsePush()) {
    return {
      phase: "unsupported",
      notice: "Этот браузер не принимает уведомления. Сообщения останутся в интерфейсе."
    };
  }

  if (!hasKey) {
    return { phase: "off", notice: "Публичный ключ Web Push не задан." };
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration("/");
    const existing = registration ? await registration.pushManager.getSubscription() : null;

    if (existing) {
      return { phase: "on", notice: "Уведомления включены на этом устройстве." };
    }
  } catch {
    return { phase: "off", notice: "Не удалось проверить уведомления браузера." };
  }

  return { phase: "off", notice: "Разрешение запрашивается только этой кнопкой." };
}

function canUsePush(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
}

async function subscribe(
  registration: ServiceWorkerRegistration | null,
  keyBytes: Uint8Array<ArrayBuffer>
): Promise<PushSubscription | null> {
  if (!registration) {
    return null;
  }

  try {
    const existing = await registration.pushManager.getSubscription();

    if (existing) {
      return existing;
    }

    return await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: keyBytes
    });
  } catch {
    return null;
  }
}

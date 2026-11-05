"use client";

import { useEffect, useState } from "react";

import { requestBrowserNotifications } from "../model/notification-center";
import { decodeVapidPublicKey, readWebPushPublicKey } from "../model/push-key";
import { registerAppServiceWorker } from "../model/register-service-worker";

type PushSupport = "unknown" | "ready" | "missing";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type WebPushControlsProps = Readonly<{
  publicKey?: string;
}>;

export function WebPushControls({ publicKey }: WebPushControlsProps) {
  const configuredKey = publicKey ?? readWebPushPublicKey();
  const keyBytes = decodeVapidPublicKey(configuredKey);
  const hasKey = keyBytes !== null;
  const [support, setSupport] = useState<PushSupport>("unknown");
  const [subscribed, setSubscribed] = useState(false);
  const [message, setMessage] = useState("Проверяем доставку при закрытой вкладке.");
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const next = detectPushSupport();
      const registration =
        next === "ready" ? await navigator.serviceWorker.getRegistration("/") : null;
      const existing = registration ? await registration.pushManager.getSubscription() : null;

      if (cancelled) {
        return;
      }

      setSupport(next);
      setSubscribed(Boolean(existing));
      setMessage(describePush(next, Boolean(existing), hasKey));
    })();

    return () => {
      cancelled = true;
    };
  }, [hasKey]);

  useEffect(() => {
    function onInstallPrompt(event: Event) {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    }

    window.addEventListener("beforeinstallprompt", onInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", onInstallPrompt);
    };
  }, []);

  async function enableDelivery() {
    if (!keyBytes) {
      return;
    }

    const permission = await requestBrowserNotifications();

    if (permission !== "granted") {
      setMessage(
        permission === "denied"
          ? "Браузер запретил уведомления. Разрешите их в настройках сайта, затем включите доставку снова."
          : "Этот браузер не поддерживает системные уведомления."
      );
      return;
    }

    const registration = await registerAppServiceWorker();

    if (!registration) {
      setMessage("Service worker не зарегистрировался. Обновите страницу и попробуйте снова.");
      return;
    }

    try {
      await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyBytes
      });
      setSubscribed(true);
      setMessage(
        "Браузер готов принимать Web Push. Сервер сохранит подписку, когда появится API. Ключ подписки не показывается и не пишется в localStorage."
      );
    } catch {
      setMessage(
        "Не удалось включить доставку. Проверьте разрешение уведомлений и попробуйте снова."
      );
    }
  }

  async function disableDelivery() {
    const registration = await navigator.serviceWorker.getRegistration("/");
    const existing = await registration?.pushManager.getSubscription();
    await existing?.unsubscribe();
    setSubscribed(false);
    setMessage("Доставка при закрытой вкладке выключена на этом устройстве.");
  }

  async function installApp() {
    if (!installEvent) {
      return;
    }

    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    setInstallEvent(null);
    setMessage(
      choice.outcome === "accepted"
        ? "Приложение добавлено на устройство."
        : "Установка отменена. Дашборд по-прежнему открывается в браузере."
    );
  }

  return (
    <>
      <p role="status">{message}</p>
      {subscribed ? (
        <button onClick={() => void disableDelivery()} type="button">
          Отключить доставку при закрытой вкладке
        </button>
      ) : (
        <button
          disabled={support !== "ready" || keyBytes === null}
          onClick={() => void enableDelivery()}
          type="button"
        >
          Включить доставку при закрытой вкладке
        </button>
      )}
      {installEvent ? (
        <button onClick={() => void installApp()} type="button">
          Установить приложение
        </button>
      ) : null}
    </>
  );
}

function detectPushSupport(): PushSupport {
  if (typeof navigator === "undefined" || typeof window === "undefined") {
    return "missing";
  }

  return "serviceWorker" in navigator && "PushManager" in window ? "ready" : "missing";
}

function describePush(support: PushSupport, subscribed: boolean, hasKey: boolean): string {
  if (support === "missing") {
    return "Этот браузер не принимает Web Push. Пока приложение открыто, сообщения остаются на экране.";
  }

  if (!hasKey) {
    return "Публичный ключ Web Push не задан. Доставка при закрытой вкладке включится после настройки сервера.";
  }

  if (subscribed) {
    return "Доставка при закрытой вкладке включена в браузере. Сервер начнёт отправлять её после API уведомлений.";
  }

  return "Доставка при закрытой вкладке выключена. Разрешение запрашивается только кнопкой ниже.";
}

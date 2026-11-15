"use client";

import {
  googleConnectResponseSchema,
  integrationDeletionResponseSchema,
  integrationListResponseSchema,
  telegramLinkResponseSchema,
  type IntegrationSummary
} from "@dashboard/contracts";
import { BellRing, CalendarDays, LockKeyhole, MapPin, Send } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { StatusBadge } from "@/components/ui/status-badge";
import { useSession } from "@/features/session";
import { browserApi } from "@/lib/api/browser-api-client";

import {
  calendarReturnMessage,
  integrationStatusLabel,
  integrationStatusTone,
  isAllowedIntegrationUrl,
  linkExpiryLabel,
  remoteIntegration,
  syncSentence,
  type CalendarReturnStatus
} from "../model/integration-view";

import styles from "./integration-list.module.scss";

type IntegrationCard = Readonly<{
  id: string;
  title: string;
  description: string;
  detail: string;
  action: string;
  status: string;
  icon: LucideIcon;
  tone: "neutral" | "warning" | "success";
}>;

type TelegramLink = Readonly<{
  url: string;
  expiresAt: string;
}>;

type LoadState = "idle" | "loading" | "ready" | "error";

const GOOGLE_HOSTS = ["accounts.google.com"] as const;
const TELEGRAM_HOSTS = ["t.me", "telegram.me"] as const;
const TELEGRAM_POLL_MS = 4_000;

const integrations: readonly IntegrationCard[] = [
  {
    id: "google-calendar",
    title: "Google Calendar",
    description: "События на сегодня и ближайшая встреча без возможности редактирования.",
    detail: "Запрашивается отдельный read-only scope только после вашего действия.",
    action: "Подключить календарь",
    status: "Не подключено",
    icon: CalendarDays,
    tone: "neutral"
  },
  {
    id: "telegram",
    title: "Telegram",
    description: "Уведомления таймера и резервный вход после безопасной привязки.",
    detail: "Привязка использует одноразовый короткоживущий токен.",
    action: "Подключить Telegram",
    status: "Не подключено",
    icon: Send,
    tone: "neutral"
  },
  {
    id: "location",
    title: "Местоположение",
    description: "Город или сокращённые координаты используются только для прогноза погоды.",
    detail: "Разрешение браузера будет запрошено только после явного нажатия.",
    action: "Настроить локацию",
    status: "Не настроено",
    icon: MapPin,
    tone: "warning"
  },
  {
    id: "browser-notifications",
    title: "Уведомления браузера",
    description: "Web Push сообщает о завершении рабочего интервала, даже если вкладка закрыта.",
    detail: "При отказе приложение продолжит показывать уведомления внутри интерфейса.",
    action: "Включить уведомления",
    status: "Выключены",
    icon: BellRing,
    tone: "warning"
  }
];

type IntegrationListProps = Readonly<{
  calendarReturn?: CalendarReturnStatus | null;
}>;

export function IntegrationList({ calendarReturn = null }: IntegrationListProps) {
  const session = useSession();
  const [remote, setRemote] = useState<readonly IntegrationSummary[]>([]);
  const [loadedKey, setLoadedKey] = useState<number | null>(null);
  const [loadError, setLoadError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [pending, setPending] = useState("");
  const [telegramLink, setTelegramLink] = useState<TelegramLink | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const timeZone = session?.user.timezone ?? "UTC";
  const loadState: LoadState = !session
    ? "idle"
    : loadedKey === reloadKey
      ? loadError
        ? "error"
        : "ready"
      : "loading";

  useEffect(() => {
    if (!session) {
      return;
    }

    const controller = new AbortController();
    const requestKey = reloadKey;

    void (async () => {
      const result = await browserApi({
        path: "/api/v1/integrations",
        schema: integrationListResponseSchema,
        signal: controller.signal
      });

      if (controller.signal.aborted) {
        return;
      }

      if (!result.ok) {
        setLoadError(result.message);
        setLoadedKey(requestKey);
        return;
      }

      setRemote(result.data.data.integrations);
      setLoadError("");
      setLoadedKey(requestKey);
    })();

    return () => {
      controller.abort();
    };
  }, [session, reloadKey]);

  useEffect(() => {
    if (!session || !telegramLink) {
      return;
    }

    const controller = new AbortController();
    let timer = 0;
    let cancelled = false;

    const poll = async () => {
      if (cancelled) {
        return;
      }

      if (document.visibilityState === "hidden") {
        timer = window.setTimeout(() => {
          void poll();
        }, TELEGRAM_POLL_MS);
        return;
      }

      if (Date.now() >= Date.parse(telegramLink.expiresAt)) {
        setTelegramLink(null);
        setActionMessage("Ссылка для привязки истекла. Запросите новую.");
        return;
      }

      const result = await browserApi({
        path: "/api/v1/integrations",
        schema: integrationListResponseSchema,
        signal: controller.signal
      });

      if (cancelled || controller.signal.aborted) {
        return;
      }

      if (!result.ok) {
        timer = window.setTimeout(() => {
          void poll();
        }, TELEGRAM_POLL_MS);
        return;
      }

      setRemote(result.data.data.integrations);
      setLoadError("");

      const linked = result.data.data.integrations.some(
        (item) => item.type === "telegram" && item.status === "connected"
      );

      if (linked) {
        setTelegramLink(null);
        setActionMessage("Telegram подключён.");
        return;
      }

      timer = window.setTimeout(() => {
        void poll();
      }, TELEGRAM_POLL_MS);
    };

    timer = window.setTimeout(() => {
      void poll();
    }, TELEGRAM_POLL_MS);

    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [session, telegramLink]);

  const calendarSummary = remoteIntegration("google-calendar", remote);
  const calendarNotice =
    calendarReturn === "connected" && loadState === "ready" && calendarSummary?.status !== "connected"
      ? null
      : calendarReturnMessage(session ? calendarReturn : null);
  const liveMessage = actionMessage || loadError || calendarNotice;

  async function runAction(id: string, connected: boolean): Promise<void> {
    setPending(id);
    setActionMessage("");

    try {
      if (id === "location") {
        document.getElementById("weather-city")?.focus();
        return;
      }

      if (id === "browser-notifications") {
        document.getElementById("web-push-enable")?.focus();
        return;
      }

      if (id === "google-calendar") {
        if (connected) {
          await disconnect("/api/v1/integrations/google");
          return;
        }

        await beginGoogle();
        return;
      }

      if (id === "telegram") {
        if (connected) {
          await disconnect("/api/v1/integrations/telegram");
          return;
        }

        await beginTelegram();
      }
    } finally {
      setPending("");
    }
  }

  async function beginGoogle(): Promise<void> {
    const result = await browserApi({
      path: "/api/v1/integrations/google/connect",
      method: "POST",
      schema: googleConnectResponseSchema,
      idempotencyKey: crypto.randomUUID()
    });

    if (!result.ok) {
      setActionMessage(result.message);
      return;
    }

    if (!isAllowedIntegrationUrl(result.data.data.url, GOOGLE_HOSTS)) {
      setActionMessage("Сервер вернул неожиданный адрес. Переход отменён.");
      return;
    }

    window.location.assign(result.data.data.url);
  }

  async function beginTelegram(): Promise<void> {
    const result = await browserApi({
      path: "/api/v1/integrations/telegram/link",
      method: "POST",
      schema: telegramLinkResponseSchema,
      idempotencyKey: crypto.randomUUID()
    });

    if (!result.ok) {
      setActionMessage(result.message);
      return;
    }

    if (!isAllowedIntegrationUrl(result.data.data.url, TELEGRAM_HOSTS)) {
      setActionMessage("Сервер вернул неожиданный адрес. Переход отменён.");
      return;
    }

    setTelegramLink({
      url: result.data.data.url,
      expiresAt: result.data.data.expiresAt
    });
    setActionMessage("Откройте бота и подтвердите привязку. Эта страница обновит статус сама.");
  }

  async function disconnect(
    path: "/api/v1/integrations/google" | "/api/v1/integrations/telegram"
  ): Promise<void> {
    const removed = await browserApi({
      path,
      method: "DELETE",
      schema: integrationDeletionResponseSchema
    });
    setActionMessage(removed.ok ? "Интеграция отключена." : removed.message);

    if (!removed.ok) {
      return;
    }

    setTelegramLink(null);
    const list = await browserApi({
      path: "/api/v1/integrations",
      schema: integrationListResponseSchema
    });

    if (list.ok) {
      setRemote(list.data.data.integrations);
      setLoadError("");
    }
  }

  return (
    <div className={styles.wrapper}>
      <aside className={styles.privacyNote}>
        <LockKeyhole aria-hidden="true" />
        <div>
          <strong>Контроль остаётся у вас</strong>
          <p>
            Интеграции подключаются отдельно. Токены и идентификаторы доставки не передаются клиенту
            без необходимости.
          </p>
        </div>
      </aside>

      {liveMessage ? (
        <p role={loadError && !actionMessage ? "alert" : "status"}>{liveMessage}</p>
      ) : null}
      {loadError ? (
        <button
          className={styles.retry}
          onClick={() => {
            setReloadKey((value) => value + 1);
          }}
          type="button"
        >
          Повторить загрузку
        </button>
      ) : null}

      <ul aria-busy={loadState === "loading"} className={styles.grid} role="list">
        {integrations.map((card) => {
          const Icon = card.icon;
          const summary = remoteIntegration(card.id, remote);
          const tracksApi = card.id === "google-calendar" || card.id === "telegram";
          const checking =
            Boolean(session) && tracksApi && (loadState === "idle" || loadState === "loading");
          const connected = Boolean(session) && summary?.status === "connected";
          const status = checking
            ? integrationStatusLabel("checking")
            : session && summary
              ? integrationStatusLabel(summary.status)
              : card.status;
          const tone = checking
            ? integrationStatusTone("checking")
            : session && summary
              ? integrationStatusTone(summary.status)
              : card.tone;
          const synced = session && summary ? syncSentence(summary.lastSyncAt, timeZone) : null;
          const detail =
            session && summary?.status === "revoked"
              ? "Доступ отозван. Подключите интеграцию снова, остальные данные сохранятся."
              : synced
                ? `${card.detail} ${synced}`
                : card.detail;
          const waitingForTelegram = card.id === "telegram" && telegramLink !== null;
          const expiry = telegramLink ? linkExpiryLabel(telegramLink.expiresAt, timeZone) : null;

          return (
            <li className={styles.card} key={card.title}>
              <div className={styles.cardHeader}>
                <div aria-hidden="true" className={styles.icon}>
                  <Icon strokeWidth={1.8} />
                </div>
                <StatusBadge tone={tone}>{status}</StatusBadge>
              </div>

              <div className={styles.cardCopy}>
                <h2>{card.title}</h2>
                <p>{card.description}</p>
              </div>

              <p className={styles.detail}>{detail}</p>

              <div className={styles.cardFooter}>
                <button
                  aria-describedby={`${card.id}-availability`}
                  disabled={!session || pending === card.id || checking || waitingForTelegram}
                  onClick={() => {
                    void runAction(card.id, connected);
                  }}
                  type="button"
                >
                  {actionLabel(card, connected, pending === card.id, waitingForTelegram)}
                </button>
                {waitingForTelegram && telegramLink ? (
                  <a href={telegramLink.url} rel="noopener noreferrer" target="_blank">
                    Открыть бота в Telegram
                  </a>
                ) : null}
                <span id={`${card.id}-availability`}>
                  {availabilityText(Boolean(session), card.id, waitingForTelegram, expiry)}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function actionLabel(
  card: IntegrationCard,
  connected: boolean,
  isPending: boolean,
  waitingForTelegram: boolean
): string {
  if (isPending) {
    return "Подключаем…";
  }

  if (waitingForTelegram) {
    return "Ждём подтверждения";
  }

  if (connected) {
    return disconnectLabel(card.id);
  }

  return card.action;
}

function disconnectLabel(id: string): string {
  if (id === "google-calendar") {
    return "Отключить календарь";
  }

  if (id === "telegram") {
    return "Отключить Telegram";
  }

  return "Открыть настройки";
}

function availabilityText(
  signedIn: boolean,
  id: string,
  waitingForTelegram: boolean,
  expiry: string | null
): string {
  if (!signedIn) {
    return "Доступно после подключения API";
  }

  if (waitingForTelegram) {
    return expiry
      ? `Подтвердите привязку в боте. Ссылка действует до ${expiry}.`
      : "Подтвердите привязку в боте.";
  }

  if (id === "location") {
    return "Откроет поле города ниже.";
  }

  if (id === "browser-notifications") {
    return "Откроет настройки уведомлений ниже.";
  }

  return "Запрос уходит на сервер только после нажатия.";
}

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

export function IntegrationList() {
  const session = useSession();
  const [remote, setRemote] = useState<readonly IntegrationSummary[]>([]);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState("");

  useEffect(() => {
    if (!session) {
      return;
    }

    let cancelled = false;

    void (async () => {
      const result = await browserApi({
        path: "/api/v1/integrations",
        schema: integrationListResponseSchema
      });

      if (!cancelled && result.ok) {
        setRemote(result.data.data.integrations);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session]);

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

      <ul className={styles.grid} role="list">
        {integrations.map((card) => {
          const Icon = card.icon;
          const connected = isConnected(card.id, remote);
          const status = session && connected ? "Подключено" : card.status;
          const tone = session && connected ? "success" : card.tone;

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

              <p className={styles.detail}>{card.detail}</p>

              <div className={styles.cardFooter}>
                <button
                  aria-describedby={`${card.id}-availability`}
                  disabled={!session || pending === card.id}
                  onClick={() => {
                    void runAction(card.id, connected, setMessage, setPending, setRemote);
                  }}
                  type="button"
                >
                  {session && connected ? disconnectLabel(card.id) : card.action}
                </button>
                <span id={`${card.id}-availability`}>
                  {session ? "Запрос уходит на сервер только после нажатия." : "Доступно после подключения API"}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
      {message ? <p role="status">{message}</p> : null}
    </div>
  );
}

function isConnected(id: string, remote: readonly IntegrationSummary[]): boolean {
  const type = id === "google-calendar" ? "google_calendar" : id === "telegram" ? "telegram" : null;

  if (!type) {
    return false;
  }

  return remote.some((item) => item.type === type && item.status === "connected");
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

async function runAction(
  id: string,
  connected: boolean,
  setMessage: (value: string) => void,
  setPending: (value: string) => void,
  setRemote: (value: readonly IntegrationSummary[]) => void
): Promise<void> {
  setPending(id);
  setMessage("");

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
      await connectOrDisconnect(
        connected,
        "/api/v1/integrations/google/connect",
        "/api/v1/integrations/google",
        ["accounts.google.com"],
        setMessage,
        setRemote
      );
      return;
    }

    if (id === "telegram") {
      await connectOrDisconnect(
        connected,
        "/api/v1/integrations/telegram/link",
        "/api/v1/integrations/telegram",
        ["t.me", "telegram.me"],
        setMessage,
        setRemote
      );
    }
  } finally {
    setPending("");
  }
}

async function connectOrDisconnect(
  connected: boolean,
  connectPath: "/api/v1/integrations/google/connect" | "/api/v1/integrations/telegram/link",
  deletePath: "/api/v1/integrations/google" | "/api/v1/integrations/telegram",
  hosts: readonly string[],
  setMessage: (value: string) => void,
  setRemote: (value: readonly IntegrationSummary[]) => void
): Promise<void> {
  if (connected) {
    const removed = await browserApi({
      path: deletePath,
      method: "DELETE",
      schema: integrationDeletionResponseSchema
    });
    setMessage(removed.ok ? "Интеграция отключена." : removed.message);

    if (removed.ok) {
      const list = await browserApi({
        path: "/api/v1/integrations",
        schema: integrationListResponseSchema
      });

      if (list.ok) {
        setRemote(list.data.data.integrations);
      }
    }

    return;
  }

  const schema =
    connectPath.endsWith("/link") ? telegramLinkResponseSchema : googleConnectResponseSchema;
  const result = await browserApi({
    path: connectPath,
    method: "POST",
    schema,
    idempotencyKey: crypto.randomUUID()
  });

  if (!result.ok) {
    setMessage(result.message);
    return;
  }

  if (!isAllowedRedirect(result.data.data.url, hosts)) {
    setMessage("Сервер вернул неожиданный адрес. Переход отменён.");
    return;
  }

  window.location.assign(result.data.data.url);
}

function isAllowedRedirect(url: string, hosts: readonly string[]): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && hosts.includes(parsed.hostname);
  } catch {
    return false;
  }
}

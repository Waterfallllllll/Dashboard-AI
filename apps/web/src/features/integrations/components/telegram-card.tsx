"use client";

import type { IntegrationStatus } from "@dashboard/contracts";
import { Send } from "lucide-react";
import { useEffect, useState } from "react";

import { StatusBadge } from "@/components/ui/status-badge";

import {
  TelegramLinkError,
  createTelegramLink,
  disconnectTelegram
} from "../api/connect-telegram";
import { loadBrowserTelegramStatus } from "../api/load-integrations";

import styles from "./integration-list.module.scss";

const IDLE_HINT = "Привязка использует одноразовый короткоживущий токен.";
const OPEN_HINT = "Откройте бота и нажмите «Старт». Ссылка действует 10 минут.";
const CONNECTED_HINT = "Бот привязан. Уведомления уходят в этот чат.";
const EXPIRED_HINT = "Ссылка на бота истекла. Запросите новую.";
const LINK_TTL_MS = 10 * 60 * 1000;
const STATUS_POLL_MS = 3000;

type TelegramCardProps = Readonly<{
  status?: IntegrationStatus | null;
  createLink?: typeof createTelegramLink;
  disconnect?: typeof disconnectTelegram;
  openLink?: (url: string) => void;
  readStatus?: typeof loadBrowserTelegramStatus;
}>;

export function TelegramCard({
  status = null,
  createLink = createTelegramLink,
  disconnect = disconnectTelegram,
  openLink = openTelegramBot,
  readStatus = loadBrowserTelegramStatus
}: TelegramCardProps) {
  const [connected, setConnected] = useState(status === "connected");
  const [pending, setPending] = useState(false);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [notice, setNotice] = useState(status === "connected" ? CONNECTED_HINT : IDLE_HINT);
  const [botUrl, setBotUrl] = useState<string | null>(null);

  useEffect(() => {
    if (status === "connected") {
      return;
    }

    const controller = new AbortController();
    let ignore = false;

    void readStatus(fetch, controller.signal).then(
      (next) => {
        if (!ignore && next === "connected") {
          setConnected(true);
          setBotUrl(null);
          setNotice(CONNECTED_HINT);
        }
      },
      () => undefined
    );

    return () => {
      ignore = true;
      controller.abort();
    };
  }, [readStatus, status]);

  useEffect(() => {
    if (!botUrl || connected) {
      return;
    }

    const timer = window.setInterval(() => {
      void readStatus(fetch).then(
        (next) => {
          if (next === "connected") {
            setConnected(true);
            setBotUrl(null);
            setNotice(CONNECTED_HINT);
          }
        },
        () => undefined
      );
    }, STATUS_POLL_MS);
    const stop = window.setTimeout(() => {
      window.clearInterval(timer);
      setBotUrl(null);
      setNotice(EXPIRED_HINT);
    }, LINK_TTL_MS);

    return () => {
      window.clearInterval(timer);
      window.clearTimeout(stop);
    };
  }, [botUrl, connected, readStatus]);

  async function startConnection(): Promise<void> {
    setPending(true);
    setNeedsLogin(false);
    setNotice("");

    try {
      const link = await createLink();
      setBotUrl(link.url);
      setNotice(OPEN_HINT);
      openLink(link.url);
    } catch (error) {
      setNeedsLogin(error instanceof TelegramLinkError && error.code === "unauthenticated");
      setNotice(
        error instanceof TelegramLinkError ? error.message : "Не удалось подключить Telegram"
      );
    } finally {
      setPending(false);
    }
  }

  async function stopConnection(): Promise<void> {
    setPending(true);
    setNeedsLogin(false);

    try {
      await disconnect();
      setConnected(false);
      setBotUrl(null);
      setNotice(IDLE_HINT);
    } catch (error) {
      setNeedsLogin(error instanceof TelegramLinkError && error.code === "unauthenticated");
      setNotice(
        error instanceof TelegramLinkError ? error.message : "Не удалось отключить Telegram"
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <li className={styles.card}>
      <div className={styles.cardHeader}>
        <div aria-hidden="true" className={styles.icon}>
          <Send strokeWidth={1.8} />
        </div>
        <StatusBadge tone={connected ? "success" : "neutral"}>
          {connected ? "Подключено" : "Не подключено"}
        </StatusBadge>
      </div>

      <div className={styles.cardCopy}>
        <h2>Telegram</h2>
        <p>Уведомления таймера и резервный вход после безопасной привязки.</p>
      </div>

      <p className={styles.detail}>
        {connected
          ? "Сообщения отправляет только сервер, в уже привязанный чат."
          : "Одноразовая ссылка открывает вашего бота. Токен бота остаётся на сервере."}
      </p>

      <div className={styles.cardFooter}>
        {connected ? (
          <button
            aria-describedby="telegram-availability"
            disabled={pending}
            onClick={() => {
              void stopConnection();
            }}
            type="button"
          >
            {pending ? "Отключаем…" : "Отключить Telegram"}
          </button>
        ) : (
          <button
            aria-describedby="telegram-availability"
            disabled={pending}
            onClick={() => {
              void startConnection();
            }}
            type="button"
          >
            {pending ? "Готовим ссылку…" : "Подключить Telegram"}
          </button>
        )}
        <span aria-live="polite" id="telegram-availability">
          {notice}
          {botUrl ? (
            <>
              {" "}
              <a href={botUrl} rel="noopener noreferrer" target="_blank">
                Открыть бота
              </a>
            </>
          ) : null}
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

function openTelegramBot(url: string): void {
  const opened = window.open(url, "_blank", "noopener,noreferrer");

  if (opened) {
    opened.opener = null;
  }
}

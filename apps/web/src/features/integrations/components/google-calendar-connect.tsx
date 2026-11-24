"use client";

import { useState } from "react";

import { CalendarConnectError, connectGoogleCalendar } from "../api/connect-google-calendar";

export type CalendarConnectionStatus = "connected" | "cancelled" | "error";

const statusMessages: Readonly<Record<CalendarConnectionStatus, string>> = {
  connected: "Календарь подключён. События появятся после синхронизации.",
  cancelled: "Подключение календаря отменено.",
  error: "Не удалось подключить календарь. Повторите попытку."
};

type GoogleCalendarConnectProps = Readonly<{
  status?: CalendarConnectionStatus | null;
  connect?: typeof connectGoogleCalendar;
  navigate?: (url: string) => void;
}>;

export function GoogleCalendarConnect({
  status = null,
  connect = connectGoogleCalendar,
  navigate = (url) => {
    window.location.assign(url);
  }
}: GoogleCalendarConnectProps) {
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState(status ? statusMessages[status] : "");
  const [needsLogin, setNeedsLogin] = useState(false);

  async function startConnection(): Promise<void> {
    setPending(true);
    setNeedsLogin(false);
    setNotice("");

    try {
      navigate(await connect());
    } catch (error) {
      setNeedsLogin(error instanceof CalendarConnectError && error.code === "unauthenticated");
      setNotice(error instanceof CalendarConnectError ? error.message : statusMessages.error);
      setPending(false);
    }
  }

  return (
    <>
      <button
        aria-describedby="google-calendar-availability"
        disabled={pending}
        onClick={() => {
          void startConnection();
        }}
        type="button"
      >
        {pending ? "Открываем Google…" : "Подключить календарь"}
      </button>
      <span id="google-calendar-availability">
        {notice || "Будет запрошено только чтение календаря."}
        {needsLogin ? (
          <>
            {" "}
            <a href="/api/v1/auth/google">Войти через Google</a>
          </>
        ) : null}
      </span>
    </>
  );
}

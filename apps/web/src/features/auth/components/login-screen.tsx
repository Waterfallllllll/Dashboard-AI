import {
  ArrowRight,
  CalendarDays,
  CloudSun,
  ListChecks,
  Newspaper,
  ShieldCheck,
  TimerReset
} from "lucide-react";
import Link from "next/link";

import styles from "./login-screen.module.scss";

type LoginStatus = "cancelled" | "error" | "loading" | null;

type LoginScreenProps = Readonly<{
  status?: LoginStatus;
}>;

const statusMessages: Readonly<Record<Exclude<LoginStatus, null>, string>> = {
  cancelled: "Вход отменён. Можно попробовать ещё раз, когда будете готовы.",
  error: "Не удалось завершить вход через Google. Повторите попытку позже.",
  loading: "Открываем безопасную страницу Google…"
};

const previewItems = [
  { icon: CloudSun, label: "Погода", value: "+18°" },
  { icon: CalendarDays, label: "Календарь", value: "3 события" },
  { icon: ListChecks, label: "Рутины", value: "4 из 6" },
  { icon: TimerReset, label: "Фокус", value: "25:00" },
  { icon: Newspaper, label: "AI-новости", value: "5 новых" }
] as const;

export function LoginScreen({ status = null }: LoginScreenProps) {
  const message = status ? statusMessages[status] : null;

  return (
    <div className={styles.screen}>
      <section aria-labelledby="login-title" className={styles.panel}>
        <div className={styles.copy}>
          <p className={styles.eyebrow}>Ваш день, собранный вместе</p>
          <h1 className={styles.title} id="login-title">
            Важное — перед глазами. Лишнее — вне фокуса.
          </h1>
          <p className={styles.description}>
            Погода, встречи, ежедневные дела, таймер и новости в одном персональном пространстве.
          </p>
        </div>

        {message ? (
          <p aria-live="polite" className={styles.notice} data-tone={status}>
            {message}
          </p>
        ) : null}

        <div className={styles.actions}>
          <button
            aria-describedby="oauth-availability"
            className={styles.googleButton}
            disabled
            type="button"
          >
            <span aria-hidden="true" className={styles.googleMark}>
              G
            </span>
            <span>{status === "loading" ? "Переходим в Google…" : "Продолжить с Google"}</span>
            <ArrowRight aria-hidden="true" />
          </button>
          <p className={styles.availability} id="oauth-availability">
            Вход станет доступен после подключения защищённого OAuth-потока.
          </p>
        </div>

        <div className={styles.securityNote}>
          <ShieldCheck aria-hidden="true" />
          <p>
            Доступ к Google Calendar запрашивается отдельно. Мы не храним OAuth-токены в браузере.
          </p>
        </div>

        <p className={styles.legal}>
          Продолжая, вы принимаете <Link href="/terms">условия использования</Link> и подтверждаете,
          что ознакомились с <Link href="/privacy">политикой конфиденциальности</Link>.
        </p>
      </section>

      <aside aria-hidden="true" className={styles.visual}>
        <div className={styles.visualHeader}>
          <span>Сегодня</span>
          <span className={styles.liveMarker}>Всё спокойно</span>
        </div>
        <div className={styles.previewGrid}>
          {previewItems.map(({ icon: Icon, label, value }, index) => (
            <div className={styles.previewCard} data-wide={index === 0 || undefined} key={label}>
              <Icon strokeWidth={1.8} />
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}

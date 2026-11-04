import { CircleUserRound, Leaf } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { NotificationHost } from "@/features/notifications";

import { AppNavigation } from "./app-navigation";
import styles from "./app-shell.module.scss";

type AppShellProps = Readonly<{
  children: ReactNode;
}>;

function Brand() {
  return (
    <Link aria-label="Evergreen Dashboard — на главную" className={styles.brand} href="/dashboard">
      <span aria-hidden="true" className={styles.brandMark}>
        <Leaf strokeWidth={2} />
      </span>
      <span className={styles.brandText}>Evergreen</span>
    </Link>
  );
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className={styles.shell}>
      <a className={styles.skipLink} href="#main-content">
        Перейти к содержимому
      </a>

      <aside className={styles.sidebar}>
        <Brand />
        <AppNavigation variant="sidebar" />
        <p className={styles.sidebarStatus}>Все важное — в одном месте</p>
      </aside>

      <div className={styles.workspace}>
        <header className={styles.topbar}>
          <div className={styles.mobileBrand}>
            <Brand />
          </div>
          <p className={styles.context}>Персональное рабочее пространство</p>
          <Link
            aria-label="Открыть профиль"
            className={styles.profileLink}
            href="/settings/profile"
          >
            <CircleUserRound aria-hidden="true" strokeWidth={1.8} />
            <span>Профиль</span>
          </Link>
        </header>

        <main className={styles.main} id="main-content" tabIndex={-1}>
          {children}
        </main>
      </div>

      <div className={styles.bottomNavigation}>
        <AppNavigation variant="bottom" />
      </div>
      <NotificationHost />
    </div>
  );
}

import { Leaf } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import styles from "./public-shell.module.scss";

type PublicShellProps = Readonly<{
  children: ReactNode;
}>;

export function PublicShell({ children }: PublicShellProps) {
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <Link className={styles.brand} href="/login">
          <span aria-hidden="true" className={styles.brandMark}>
            <Leaf strokeWidth={2} />
          </span>
          <span>Evergreen Dashboard</span>
        </Link>
        <nav aria-label="Юридическая информация" className={styles.navigation}>
          <Link href="/privacy">Конфиденциальность</Link>
          <Link href="/terms">Условия</Link>
        </nav>
      </header>
      <main className={styles.main} id="main-content">
        {children}
      </main>
    </div>
  );
}

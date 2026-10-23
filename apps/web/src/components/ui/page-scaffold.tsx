import type { ReactNode } from "react";

import styles from "./page-scaffold.module.scss";

type PageScaffoldProps = Readonly<{
  title: string;
  description: string;
  eyebrow?: string;
  children?: ReactNode;
  contentVariant?: "card" | "plain";
}>;

export function PageScaffold({
  children,
  contentVariant = "card",
  description,
  eyebrow = "Evergreen Dashboard",
  title
}: PageScaffoldProps) {
  return (
    <section aria-labelledby="page-title" className={styles.page}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>{eyebrow}</p>
        <h1 className={styles.title} id="page-title">
          {title}
        </h1>
        <p className={styles.description}>{description}</p>
      </header>
      {children ? (
        <div className={styles.content} data-variant={contentVariant}>
          {children}
        </div>
      ) : null}
    </section>
  );
}

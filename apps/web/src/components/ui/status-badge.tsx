import type { ReactNode } from "react";

import styles from "./status-badge.module.scss";

type StatusBadgeProps = Readonly<{
  children: ReactNode;
  tone?: "neutral" | "success" | "warning" | "error" | "info";
}>;

export function StatusBadge({ children, tone = "neutral" }: StatusBadgeProps) {
  return (
    <span className={styles.badge} data-tone={tone}>
      {children}
    </span>
  );
}

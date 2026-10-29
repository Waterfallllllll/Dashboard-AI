"use client";

import { useEffect, useRef } from "react";

import {
  applyThemePreference,
  persistThemePreference,
  readThemePreference
} from "@/lib/theme/theme-preference";
import type { ThemePreference } from "@/lib/theme/theme-preference";

import styles from "./theme-control.module.scss";

export function ThemeControl() {
  const selectRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    const syncTheme = () => {
      const theme = readThemePreference();
      applyThemePreference(theme);

      if (selectRef.current) {
        selectRef.current.value = theme;
      }
    };

    syncTheme();
    window.addEventListener("storage", syncTheme);

    return () => {
      window.removeEventListener("storage", syncTheme);
    };
  }, []);

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor="theme-preference">
        Тема интерфейса
      </label>
      <select
        className={styles.select}
        defaultValue="system"
        id="theme-preference"
        onChange={(event) => {
          const theme = event.currentTarget.value as ThemePreference;
          persistThemePreference(theme);
          applyThemePreference(theme);
        }}
        ref={selectRef}
      >
        <option value="system">Как в системе</option>
        <option value="light">Светлая</option>
        <option value="dark">Тёмная</option>
      </select>
      <p className={styles.hint}>
        Системная тема меняется автоматически вместе с настройкой устройства.
      </p>
    </div>
  );
}

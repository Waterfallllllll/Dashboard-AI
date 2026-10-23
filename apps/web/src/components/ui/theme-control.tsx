"use client";

import { useEffect, useRef } from "react";

import styles from "./theme-control.module.scss";

type ThemePreference = "system" | "light" | "dark";

const STORAGE_KEY = "evergreen-theme";

function readThemePreference(): ThemePreference {
  try {
    const storedTheme = window.localStorage.getItem(STORAGE_KEY);

    return storedTheme === "light" || storedTheme === "dark" ? storedTheme : "system";
  } catch {
    return "system";
  }
}

function applyThemePreference(theme: ThemePreference) {
  const root = document.documentElement;

  if (theme === "system") {
    root.removeAttribute("data-theme");
    root.style.colorScheme = "light dark";
    return;
  }

  root.dataset.theme = theme;
  root.style.colorScheme = theme;
}

function persistThemePreference(theme: ThemePreference) {
  try {
    if (theme === "system") {
      window.localStorage.removeItem(STORAGE_KEY);
    } else {
      window.localStorage.setItem(STORAGE_KEY, theme);
    }
  } catch {
    // The selected theme still applies for the current tab when storage is unavailable.
  }
}

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

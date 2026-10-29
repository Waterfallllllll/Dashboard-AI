export const THEME_STORAGE_KEY = "evergreen-theme";

export type ThemePreference = "system" | "light" | "dark";

export function parseThemePreference(storedTheme: string | null): ThemePreference {
  return storedTheme === "light" || storedTheme === "dark" ? storedTheme : "system";
}

export function applyThemePreference(
  theme: ThemePreference,
  root: HTMLElement = document.documentElement
): void {
  if (theme === "system") {
    root.removeAttribute("data-theme");
    root.style.colorScheme = "light dark";
    return;
  }

  root.dataset.theme = theme;
  root.style.colorScheme = theme;
}

export function persistThemePreference(
  theme: ThemePreference,
  storage: Pick<Storage, "setItem" | "removeItem"> = window.localStorage
): void {
  try {
    if (theme === "system") {
      storage.removeItem(THEME_STORAGE_KEY);
      return;
    }

    storage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // The selected theme still applies for the current tab when storage is unavailable.
  }
}

export function readThemePreference(
  storage: Pick<Storage, "getItem"> = window.localStorage
): ThemePreference {
  try {
    return parseThemePreference(storage.getItem(THEME_STORAGE_KEY));
  } catch {
    return "system";
  }
}

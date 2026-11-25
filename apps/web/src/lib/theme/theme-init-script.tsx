"use client";

import { THEME_STORAGE_KEY } from "./theme-preference";

const themeInitializationScript = `
  try {
    const theme = localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
    if (theme === "light" || theme === "dark") {
      document.documentElement.dataset.theme = theme;
      document.documentElement.style.colorScheme = theme;
    }
  } catch {}
`;

export function ThemeInitScript() {
  return (
    <script
      dangerouslySetInnerHTML={{ __html: themeInitializationScript }}
      suppressHydrationWarning
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
    />
  );
}

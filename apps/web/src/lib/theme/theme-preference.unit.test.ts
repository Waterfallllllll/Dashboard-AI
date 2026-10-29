import { describe, expect, it } from "vitest";

import { parseThemePreference, persistThemePreference, THEME_STORAGE_KEY } from "./theme-preference";

describe("parseThemePreference", () => {
  it("принимает только light и dark, иначе system", () => {
    expect(parseThemePreference("light")).toBe("light");
    expect(parseThemePreference("dark")).toBe("dark");
    expect(parseThemePreference("system")).toBe("system");
    expect(parseThemePreference("high-contrast")).toBe("system");
    expect(parseThemePreference(null)).toBe("system");
  });
});

describe("persistThemePreference", () => {
  it("пишет явную тему и удаляет ключ для system", () => {
    const storage = new Map<string, string>();

    persistThemePreference("dark", {
      setItem: (key, value) => {
        storage.set(key, value);
      },
      removeItem: (key) => {
        storage.delete(key);
      }
    });

    expect(storage.get(THEME_STORAGE_KEY)).toBe("dark");

    persistThemePreference("system", {
      setItem: (key, value) => {
        storage.set(key, value);
      },
      removeItem: (key) => {
        storage.delete(key);
      }
    });

    expect(storage.has(THEME_STORAGE_KEY)).toBe(false);
  });
});

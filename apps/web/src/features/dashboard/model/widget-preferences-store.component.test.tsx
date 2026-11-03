import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getWidgetPreferencesSnapshot,
  resetWidgetPreferencesStoreForTests,
  updateWidgetPreferences
} from "./widget-preferences-store";
import {
  createDefaultPreferences,
  toggleWidget,
  WIDGET_PREFERENCES_STORAGE_KEY,
  WIDGET_SAVE_DELAY_MS
} from "./widget-preferences";

describe("widget preferences store", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    window.localStorage.clear();
    resetWidgetPreferencesStoreForTests();
  });

  it("откатывает настройки, если запись в хранилище не удалась", () => {
    vi.useFakeTimers();
    resetWidgetPreferencesStoreForTests();
    getWidgetPreferencesSnapshot();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });

    updateWidgetPreferences((current) => toggleWidget(current, "timer", false));
    expect(getWidgetPreferencesSnapshot().saveStatus).toBe("pending");

    vi.advanceTimersByTime(WIDGET_SAVE_DELAY_MS);

    expect(getWidgetPreferencesSnapshot().saveStatus).toBe("error");
    expect(getWidgetPreferencesSnapshot().preferences).toEqual(createDefaultPreferences());
    expect(window.localStorage.getItem(WIDGET_PREFERENCES_STORAGE_KEY)).toBeNull();
  });
});

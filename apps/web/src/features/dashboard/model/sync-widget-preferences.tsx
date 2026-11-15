"use client";

import { useEffect } from "react";

import {
  widgetPreferencesResponseSchema,
  type WidgetPreference as ApiWidgetPreference,
  type WidgetPreferences,
  type WidgetPreferencesPatch,
  type WidgetType
} from "@dashboard/contracts";

import { getTimerSettingsSnapshot } from "@/features/timer";
import { browserApi } from "@/lib/api/browser-api-client";
import { getCsrfToken } from "@/lib/api/csrf-memory";

import {
  createDefaultPreferences,
  type WidgetPreference
} from "./widget-preferences";
import {
  getWidgetPreferencesSnapshot,
  subscribeWidgetPreferences,
  updateWidgetPreferences
} from "./widget-preferences-store";

const versions = new Map<WidgetType, number>();
let lastSent = "";
let applyingRemote = false;

export function WidgetPreferencesSync() {
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const result = await browserApi({
        path: "/api/v1/widgets/preferences",
        schema: widgetPreferencesResponseSchema
      });

      if (!result.ok || cancelled) {
        return;
      }

      const local = rememberPreferences(result.data.data);
      applyingRemote = true;
      lastSent = JSON.stringify(local);
      updateWidgetPreferences(() => local);
      applyingRemote = false;
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return subscribeWidgetPreferences(() => {
      if (applyingRemote) {
        return;
      }

      const snapshot = getWidgetPreferencesSnapshot();

      if (snapshot.saveStatus !== "saved") {
        return;
      }

      const serialized = JSON.stringify(snapshot.preferences);

      if (serialized === lastSent || !getCsrfToken()) {
        return;
      }

      void pushPreferences(snapshot.preferences, serialized);
    });
  }, []);

  return null;
}

async function pushPreferences(
  preferences: readonly WidgetPreference[],
  serialized: string
): Promise<void> {
  const body = toApiPatch(preferences);

  if (!body) {
    return;
  }

  const result = await browserApi({
    path: "/api/v1/widgets/preferences",
    method: "PATCH",
    schema: widgetPreferencesResponseSchema,
    body
  });

  if (!result.ok) {
    return;
  }

  const local = rememberPreferences(result.data.data);
  lastSent = JSON.stringify(local);

  if (lastSent !== serialized) {
    applyingRemote = true;
    updateWidgetPreferences(() => local);
    applyingRemote = false;
  }
}

function rememberPreferences(remote: WidgetPreferences): readonly WidgetPreference[] {
  versions.clear();

  for (const widget of remote.widgets) {
    versions.set(widget.widgetType, widget.version);
  }

  return toLocalPreferences(remote.widgets);
}

function toLocalPreferences(widgets: readonly ApiWidgetPreference[]): readonly WidgetPreference[] {
  const defaults = new Map(createDefaultPreferences().map((item) => [item.type, item]));

  return widgets
    .slice()
    .sort((left, right) => left.position - right.position)
    .flatMap((widget) => {
      const fallback = defaults.get(widget.widgetType);

      if (!fallback) {
        return [];
      }

      return [
        {
          ...fallback,
          type: widget.widgetType,
          enabled: widget.enabled,
          position: widget.position,
          size: widget.size === "full" ? "wide" : widget.size,
          itemLimit: widget.settings.itemLimit ?? fallback.itemLimit,
          refreshMinutes: widget.settings.refreshMinutes ?? fallback.refreshMinutes,
          temperatureUnit: widget.settings.temperatureUnit ?? fallback.temperatureUnit,
          newsSourceMode: widget.settings.newsSourceMode ?? fallback.newsSourceMode,
          calendarScope: widget.settings.calendarScope ?? fallback.calendarScope
        }
      ];
    });
}

function toApiPatch(preferences: readonly WidgetPreference[]): WidgetPreferencesPatch | null {
  if (preferences.length !== 6 || versions.size !== 6) {
    return null;
  }

  const timer = getTimerSettingsSnapshot().settings;

  return {
    widgets: preferences.map((widget) => ({
      widgetType: widget.type,
      enabled: widget.enabled,
      position: widget.position,
      size: widget.size,
      settings: settingsFor(widget, timer.dailyGoal, timer.volume),
      version: versions.get(widget.type) ?? 1
    }))
  };
}

function settingsFor(
  widget: WidgetPreference,
  dailyGoal: number,
  volume: number
): WidgetPreferencesPatch["widgets"][number]["settings"] {
  switch (widget.type) {
    case "datetime":
      return {};
    case "weather":
      return {
        refreshMinutes: widget.refreshMinutes,
        temperatureUnit: widget.temperatureUnit
      };
    case "calendar":
      return {
        itemLimit: widget.itemLimit,
        refreshMinutes: widget.refreshMinutes,
        calendarScope: widget.calendarScope
      };
    case "routines":
      return { itemLimit: widget.itemLimit };
    case "timer":
      return { dailyGoal, volume };
    case "news":
      return {
        itemLimit: widget.itemLimit,
        refreshMinutes: widget.refreshMinutes,
        newsSourceMode: widget.newsSourceMode
      };
  }
}

import { API_ERROR_CODES } from "@dashboard/contracts";
import type {
  WidgetPreference,
  WidgetPreferences,
  WidgetPreferencesPatch
} from "@dashboard/contracts";

import { ApiError } from "../../shared/errors/api-error.js";
import type { Actor } from "../auth/auth.types.js";
import {
  DEFAULT_WIDGET_ORDER,
  defaultWidgetSettings,
  layoutFieldErrors,
  normalizeSettings
} from "./widgets.layout.js";
import type { WidgetsRepository } from "./widgets.repository.js";
import type { DashboardConfigRecord, WidgetRecord } from "./widgets.types.js";

export class WidgetsService {
  constructor(
    private readonly widgets: WidgetsRepository,
    private readonly now: () => Date = () => new Date()
  ) {}

  async get(actor: Actor): Promise<WidgetPreferences> {
    const existing = await this.owned(actor);

    if (existing) {
      return toPreferences(existing);
    }

    const created = defaultConfig(actor.userId, this.now());
    const inserted = await this.widgets.insert(created);

    if (inserted === "exists") {
      const raced = await this.owned(actor);

      if (!raced) {
        throw new ApiError({ code: API_ERROR_CODES.conflict });
      }

      return toPreferences(raced);
    }

    return toPreferences(created);
  }

  async update(actor: Actor, patch: WidgetPreferencesPatch): Promise<WidgetPreferences> {
    const errors = layoutFieldErrors(patch.widgets);

    if (errors) {
      throw new ApiError({ code: API_ERROR_CODES.validationFailed, fieldErrors: errors });
    }

    const current = await this.owned(actor);
    const baseline = current ?? defaultConfig(actor.userId, this.now());

    if (!current) {
      const inserted = await this.widgets.insert(baseline);

      if (inserted === "exists") {
        throw new ApiError({ code: API_ERROR_CODES.conflict });
      }
    }

    const storedByType = new Map(baseline.widgets.map((widget) => [widget.widgetType, widget]));
    const stale = patch.widgets.some(
      (widget) => storedByType.get(widget.widgetType)?.version !== widget.version
    );

    if (stale) {
      throw new ApiError({ code: API_ERROR_CODES.conflict });
    }

    const now = this.now();
    const next = patch.widgets.map((widget) => ({
      widgetType: widget.widgetType,
      enabled: widget.enabled,
      position: widget.position,
      size: widget.size,
      settings: normalizeSettings(widget.widgetType, widget.settings),
      version: widget.version + 1,
      updatedAt: now
    }));
    const saved = await this.widgets.replace(actor.userId, next, baseline.updatedAt, now);

    if (saved === "conflict") {
      throw new ApiError({ code: API_ERROR_CODES.conflict });
    }

    return this.sameUser(actor, saved);
  }

  async dailyGoal(userId: string): Promise<number> {
    const config = await this.widgets.findByUser(userId);

    if (!config || config.userId !== userId) {
      return 8;
    }

    const goal = config.widgets.find((widget) => widget.widgetType === "timer")?.settings.dailyGoal;
    return typeof goal === "number" && Number.isInteger(goal) && goal >= 1 && goal <= 24 ? goal : 8;
  }

  private async owned(actor: Actor): Promise<DashboardConfigRecord | null> {
    const config = await this.widgets.findByUser(actor.userId);

    if (config && config.userId !== actor.userId) {
      throw new ApiError({ code: API_ERROR_CODES.notFound });
    }

    return config;
  }

  private sameUser(actor: Actor, config: DashboardConfigRecord): WidgetPreferences {
    if (config.userId !== actor.userId) {
      throw new ApiError({ code: API_ERROR_CODES.notFound });
    }

    return toPreferences(config);
  }
}

function defaultConfig(userId: string, now: Date): DashboardConfigRecord {
  return {
    userId,
    updatedAt: now,
    widgets: DEFAULT_WIDGET_ORDER.map((widget, position) => ({
      widgetType: widget.widgetType,
      enabled: true,
      position,
      size: widget.size,
      settings: defaultWidgetSettings(widget.widgetType),
      version: 1,
      updatedAt: now
    }))
  };
}

function toPreferences(config: DashboardConfigRecord): WidgetPreferences {
  return {
    updatedAt: config.updatedAt.toISOString(),
    widgets: config.widgets.map(toPreference)
  };
}

function toPreference(widget: WidgetRecord): WidgetPreference {
  return {
    widgetType: widget.widgetType,
    enabled: widget.enabled,
    position: widget.position,
    size: widget.size,
    settings: widget.settings,
    version: widget.version,
    updatedAt: widget.updatedAt.toISOString()
  };
}

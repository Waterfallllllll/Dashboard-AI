import type { WidgetSettings } from "@dashboard/contracts";
import { widgetSettingsSchema } from "@dashboard/contracts";

import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";
import { isUniqueViolation } from "../../shared/prisma-error.js";
import { parseUuid } from "../../shared/public-id.js";
import { normalizeSettings } from "./widgets.layout.js";
import type { DashboardConfigRecord, WidgetRecord } from "./widgets.types.js";
import type { WidgetsRepository } from "./widgets.repository.js";

const SETTING_KEYS = [
  "itemLimit",
  "refreshMinutes",
  "temperatureUnit",
  "newsSourceMode",
  "calendarScope",
  "dailyGoal",
  "volume"
] as const;

type WidgetRow = {
  widgetType: WidgetRecord["widgetType"];
  enabled: boolean;
  position: number;
  size: WidgetRecord["size"];
  settings: Prisma.JsonValue;
  version: number;
  updatedAt: Date;
};

export class PrismaWidgetsRepository implements WidgetsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByUser(userId: string): Promise<DashboardConfigRecord | null> {
    const id = parseUuid(userId);

    if (!id) {
      return null;
    }

    const rows = await this.prisma.widgetPreference.findMany({
      where: { userId: id },
      orderBy: { position: "asc" }
    });
    return rows.length === 0 ? null : toConfig(id, rows);
  }

  async insert(config: DashboardConfigRecord): Promise<"inserted" | "exists"> {
    const userId = parseUuid(config.userId);

    if (!userId) {
      return "exists";
    }

    try {
      await this.prisma.widgetPreference.createMany({
        data: config.widgets.map((widget) => widgetData(userId, widget, config.updatedAt))
      });
      return "inserted";
    } catch (error) {
      if (isUniqueViolation(error)) {
        return "exists";
      }

      throw error;
    }
  }

  async replace(
    userId: string,
    widgets: readonly WidgetRecord[],
    expectedUpdatedAt: Date,
    now: Date
  ): Promise<DashboardConfigRecord | "conflict"> {
    const id = parseUuid(userId);

    if (!id) {
      return "conflict";
    }

    return this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ updated_at: Date }>>`
        SELECT updated_at FROM widget_preferences WHERE user_id = ${id}::uuid FOR UPDATE
      `;

      if (
        locked.length === 0 ||
        locked.some((row) => new Date(row.updated_at).getTime() !== expectedUpdatedAt.getTime())
      ) {
        return "conflict";
      }

      await tx.widgetPreference.deleteMany({ where: { userId: id } });
      await tx.widgetPreference.createMany({
        data: widgets.map((widget) => widgetData(id, widget, now))
      });
      const rows = await tx.widgetPreference.findMany({
        where: { userId: id },
        orderBy: { position: "asc" }
      });
      return toConfig(id, rows);
    });
  }
}

function widgetData(
  userId: string,
  widget: WidgetRecord,
  updatedAt: Date
): Prisma.WidgetPreferenceCreateManyInput {
  return {
    userId,
    widgetType: widget.widgetType,
    enabled: widget.enabled,
    position: widget.position,
    size: widget.size,
    settings: settingsJson(widget.settings),
    version: widget.version,
    updatedAt
  };
}

function toConfig(userId: string, rows: readonly WidgetRow[]): DashboardConfigRecord {
  const updatedAt = rows.reduce(
    (latest, row) => (row.updatedAt > latest ? row.updatedAt : latest),
    rows[0]?.updatedAt ?? new Date(0)
  );

  return {
    userId,
    widgets: rows.map(toWidget),
    updatedAt
  };
}

function toWidget(row: WidgetRow): WidgetRecord {
  return {
    widgetType: row.widgetType,
    enabled: row.enabled,
    position: row.position,
    size: row.size,
    settings: readSettings(row.widgetType, row.settings),
    version: row.version,
    updatedAt: row.updatedAt
  };
}

function readSettings(type: WidgetRecord["widgetType"], raw: Prisma.JsonValue): WidgetSettings {
  const candidate: Record<string, unknown> = {};

  if (typeof raw === "object" && raw !== null && !Array.isArray(raw)) {
    for (const key of SETTING_KEYS) {
      if (Object.prototype.hasOwnProperty.call(raw, key)) {
        candidate[key] = raw[key];
      }
    }
  }

  const parsed = widgetSettingsSchema.safeParse(candidate);
  return normalizeSettings(type, parsed.success ? parsed.data : {});
}

function settingsJson(settings: WidgetSettings): Prisma.InputJsonValue {
  const document: Record<string, string | number> = {};

  for (const key of SETTING_KEYS) {
    const value = settings[key];

    if (typeof value === "string" || typeof value === "number") {
      document[key] = value;
    }
  }

  return document;
}

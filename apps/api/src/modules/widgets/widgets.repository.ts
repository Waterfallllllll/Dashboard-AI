import type { MatchKeysAndValues } from "mongodb";
import { ObjectId, type Db } from "mongodb";

import type { WidgetSettings } from "@dashboard/contracts";
import { widgetSettingsSchema } from "@dashboard/contracts";

import type {
  DashboardConfigDocument,
  WidgetPreferenceDocument
} from "../../infrastructure/mongodb/collection-catalog.js";
import { isDuplicateKey } from "../../shared/mongo-error.js";
import { parseObjectId } from "../../shared/object-id.js";
import { normalizeSettings } from "./widgets.layout.js";
import type { DashboardConfigRecord, WidgetRecord } from "./widgets.types.js";

export type WidgetsRepository = {
  findByUser(userId: string): Promise<DashboardConfigRecord | null>;
  insert(config: DashboardConfigRecord): Promise<"inserted" | "exists">;
  replace(
    userId: string,
    widgets: readonly WidgetRecord[],
    expectedUpdatedAt: Date,
    now: Date
  ): Promise<DashboardConfigRecord | "conflict">;
};

const SETTING_KEYS = [
  "itemLimit",
  "refreshMinutes",
  "temperatureUnit",
  "newsSourceMode",
  "calendarScope",
  "dailyGoal",
  "volume"
] as const;

export class MongoWidgetsRepository implements WidgetsRepository {
  constructor(private readonly db: Db) {}

  async findByUser(userId: string): Promise<DashboardConfigRecord | null> {
    const id = parseObjectId(userId);

    if (!id) {
      return null;
    }

    const document = await this.collection().findOne({ userId: id });
    return document ? toConfig(document) : null;
  }

  async insert(config: DashboardConfigRecord): Promise<"inserted" | "exists"> {
    const userId = parseObjectId(config.userId);

    if (!userId) {
      return "exists";
    }

    try {
      await this.collection().insertOne({
        _id: new ObjectId(),
        schemaVersion: 1,
        userId,
        widgets: config.widgets.map(toEmbedded),
        updatedAt: config.updatedAt
      });
      return "inserted";
    } catch (error) {
      if (isDuplicateKey(error)) {
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
    const id = parseObjectId(userId);

    if (!id) {
      return "conflict";
    }

    const document = await this.collection().findOneAndUpdate(
      { userId: id, updatedAt: expectedUpdatedAt },
      {
        $set: {
          widgets: widgets.map(toEmbedded),
          updatedAt: now
        } as MatchKeysAndValues<DashboardConfigDocument>
      },
      { returnDocument: "after" }
    );

    if (!document || document.userId.toHexString() !== userId) {
      return "conflict";
    }

    return toConfig(document);
  }

  private collection() {
    return this.db.collection<DashboardConfigDocument>("dashboard_configs");
  }
}

function toConfig(document: DashboardConfigDocument): DashboardConfigRecord {
  return {
    userId: document.userId.toHexString(),
    widgets: document.widgets.map(toWidget),
    updatedAt: document.updatedAt
  };
}

function toWidget(widget: WidgetPreferenceDocument): WidgetRecord {
  return {
    widgetType: widget.widgetType,
    enabled: widget.enabled,
    position: widget.position,
    size: widget.size,
    settings: readSettings(widget.widgetType, widget.settings),
    version: widget.version,
    updatedAt: widget.updatedAt
  };
}

function toEmbedded(widget: WidgetRecord): WidgetPreferenceDocument {
  return {
    widgetType: widget.widgetType,
    enabled: widget.enabled,
    position: widget.position,
    size: widget.size,
    settings: settingsDocument(widget.settings),
    version: widget.version,
    updatedAt: widget.updatedAt
  };
}

function readSettings(
  type: WidgetRecord["widgetType"],
  raw: Readonly<Record<string, unknown>>
): WidgetSettings {
  const candidate: Record<string, unknown> = {};

  for (const key of SETTING_KEYS) {
    if (Object.prototype.hasOwnProperty.call(raw, key)) {
      candidate[key] = raw[key];
    }
  }

  const parsed = widgetSettingsSchema.safeParse(candidate);
  return normalizeSettings(type, parsed.success ? parsed.data : {});
}

function settingsDocument(settings: WidgetSettings): Record<string, string | number> {
  const document: Record<string, string | number> = {};

  for (const key of SETTING_KEYS) {
    const value = settings[key];

    if (typeof value === "string" || typeof value === "number") {
      document[key] = value;
    }
  }

  return document;
}

import { ObjectId, type Db, type Document } from "mongodb";

import type { CollectionName } from "./collection-catalog.js";
import { deliveryRetentionViolation } from "./retention.js";
import {
  assertStoredCollections,
  USER_OWNED_COLLECTIONS,
  type UserOwnedCollection
} from "./user-data.js";

const MAX_VIOLATIONS = 50;

export type WidgetViolationCode =
  "DUPLICATE_WIDGET" | "DUPLICATE_WIDGET_POSITION" | "INVALID_WIDGET";

export type IntegrityCode =
  | "ORPHAN_USER"
  | "ROUTINE_RULE_MISSING"
  | "ROUTINE_OWNER_MISMATCH"
  | WidgetViolationCode
  | "DELIVERY_WITHOUT_EXPIRY"
  | "DELIVERY_EXPIRY_OUT_OF_POLICY"
  | "CALENDAR_INTEGRATION_MISSING"
  | "CALENDAR_OWNER_MISMATCH";

export type IntegrityViolation = {
  readonly code: IntegrityCode;
  readonly collection: CollectionName;
  readonly documentId: string;
};

export type IntegrityReport = {
  readonly ok: boolean;
  readonly scanned: Readonly<Record<string, number>>;
  readonly violations: readonly IntegrityViolation[];
  readonly truncated: boolean;
};

const PROJECTIONS: Readonly<Record<UserOwnedCollection, Document>> = {
  auth_accounts: { userId: 1 },
  sessions: { userId: 1 },
  dashboard_configs: { userId: 1, "widgets.widgetType": 1, "widgets.position": 1 },
  routine_rules: { userId: 1 },
  routine_occurrences: { userId: 1, routineRuleId: 1 },
  timer_sessions: { userId: 1 },
  integrations: { userId: 1 },
  calendar_events: { userId: 1, integrationId: 1 },
  push_subscriptions: { userId: 1 },
  notification_deliveries: { userId: 1, createdAt: 1, deleteAt: 1 }
};

export function widgetShapeViolations(widgets: readonly unknown[]): readonly WidgetViolationCode[] {
  const codes = new Set<WidgetViolationCode>();
  const types = new Set<string>();
  const positions = new Set<number>();

  for (const widget of widgets) {
    if (
      !isRecord(widget) ||
      typeof widget.widgetType !== "string" ||
      typeof widget.position !== "number"
    ) {
      codes.add("INVALID_WIDGET");
      continue;
    }

    if (types.has(widget.widgetType)) {
      codes.add("DUPLICATE_WIDGET");
    }

    types.add(widget.widgetType);

    if (positions.has(widget.position)) {
      codes.add("DUPLICATE_WIDGET_POSITION");
    }

    positions.add(widget.position);
  }

  return [...codes];
}

export async function checkDataIntegrity(db: Db): Promise<IntegrityReport> {
  await assertStoredCollections(db);
  const violations: IntegrityViolation[] = [];
  let truncated = false;
  const scanned: Record<string, number> = {};
  const userIds = new Set<string>();
  let usersScanned = 0;

  for await (const user of db.collection("users").find({}, { projection: { _id: 1 } })) {
    usersScanned += 1;

    if (user._id instanceof ObjectId) {
      userIds.add(user._id.toHexString());
    }
  }

  scanned.users = usersScanned;

  const ruleOwners = new Map<string, string>();
  const integrationOwners = new Map<string, string>();

  for (const name of USER_OWNED_COLLECTIONS) {
    let count = 0;
    const cursor = db.collection(name).find({}, { projection: PROJECTIONS[name] });

    for await (const doc of cursor) {
      count += 1;
      collectViolations(name, doc, userIds, ruleOwners, integrationOwners, violations, () => {
        truncated = true;
      });
    }

    scanned[name] = count;
  }

  return {
    ok: violations.length === 0,
    scanned,
    violations,
    truncated
  };
}

function collectViolations(
  name: UserOwnedCollection,
  doc: Document,
  userIds: ReadonlySet<string>,
  ruleOwners: Map<string, string>,
  integrationOwners: Map<string, string>,
  violations: IntegrityViolation[],
  onTruncate: () => void
): void {
  const userId = doc["userId"];
  const documentId = doc["_id"];

  if (!(userId instanceof ObjectId) || !userIds.has(userId.toHexString())) {
    pushViolation(violations, "ORPHAN_USER", name, documentId, onTruncate);
  }

  if (name === "routine_rules" && documentId instanceof ObjectId && userId instanceof ObjectId) {
    ruleOwners.set(documentId.toHexString(), userId.toHexString());
  }

  if (name === "integrations" && documentId instanceof ObjectId && userId instanceof ObjectId) {
    integrationOwners.set(documentId.toHexString(), userId.toHexString());
  }

  if (name === "calendar_events") {
    const integrationId = doc["integrationId"];
    const owner = integrationId instanceof ObjectId ? integrationOwners.get(integrationId.toHexString()) : undefined;

    if (owner === undefined) {
      pushViolation(violations, "CALENDAR_INTEGRATION_MISSING", name, documentId, onTruncate);
    } else if (!(userId instanceof ObjectId) || owner !== userId.toHexString()) {
      pushViolation(violations, "CALENDAR_OWNER_MISMATCH", name, documentId, onTruncate);
    }
  }

  if (name === "routine_occurrences") {
    const ruleId = doc["routineRuleId"];
    const owner = ruleId instanceof ObjectId ? ruleOwners.get(ruleId.toHexString()) : undefined;

    if (owner === undefined) {
      pushViolation(violations, "ROUTINE_RULE_MISSING", name, documentId, onTruncate);
    } else if (!(userId instanceof ObjectId) || owner !== userId.toHexString()) {
      pushViolation(violations, "ROUTINE_OWNER_MISMATCH", name, documentId, onTruncate);
    }
  }

  if (name === "dashboard_configs") {
    const widgets = doc["widgets"];

    if (!Array.isArray(widgets)) {
      pushViolation(violations, "INVALID_WIDGET", name, documentId, onTruncate);
      return;
    }

    for (const code of widgetShapeViolations(widgets)) {
      pushViolation(violations, code, name, documentId, onTruncate);
    }
  }

  if (name === "notification_deliveries") {
    const deleteAt = doc["deleteAt"];
    const code =
      deleteAt != null && !(deleteAt instanceof Date)
        ? "DELIVERY_EXPIRY_OUT_OF_POLICY"
        : deliveryRetentionViolation(
            doc["createdAt"] instanceof Date ? doc["createdAt"] : new Date(Number.NaN),
            deleteAt instanceof Date ? deleteAt : null
          );

    if (code) {
      pushViolation(violations, code, name, documentId, onTruncate);
    }
  }
}

function pushViolation(
  violations: IntegrityViolation[],
  code: IntegrityCode,
  collection: CollectionName,
  documentId: unknown,
  onTruncate: () => void
): void {
  if (violations.length >= MAX_VIOLATIONS) {
    onTruncate();
    return;
  }

  violations.push({
    code,
    collection,
    documentId: documentId instanceof ObjectId ? documentId.toHexString() : "unknown"
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

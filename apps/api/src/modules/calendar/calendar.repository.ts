import { ObjectId, type Db } from "mongodb";

import type { CalendarEventDocument } from "../../infrastructure/mongodb/collection-catalog.js";
import { parseObjectId } from "../../shared/object-id.js";
import type { NormalizedEvent } from "./calendar-model.js";

export type StoredCalendarEvent = NormalizedEvent & {
  readonly id: string;
  readonly userId: string;
  readonly integrationId: string;
  readonly calendarName: string;
  readonly updatedAt: Date;
};

export type CalendarRepository = {
  apply(
    userId: string,
    integrationId: string,
    upserts: readonly NormalizedEvent[],
    deletedIds: readonly string[],
    now: Date
  ): Promise<void>;
  replaceWindow(
    userId: string,
    integrationId: string,
    events: readonly NormalizedEvent[],
    from: Date,
    to: Date,
    now: Date
  ): Promise<void>;
  listRange(userId: string, from: Date, to: Date): Promise<readonly StoredCalendarEvent[]>;
  deleteForUser(userId: string): Promise<void>;
};

const CALENDAR_NAME = "Основной";

export class MongoCalendarRepository implements CalendarRepository {
  constructor(private readonly db: Db) {}

  async apply(
    userId: string,
    integrationId: string,
    upserts: readonly NormalizedEvent[],
    deletedIds: readonly string[],
    now: Date
  ): Promise<void> {
    const ids = idsOf(userId, integrationId);

    if (!ids) {
      return;
    }

    for (const event of upserts) {
      await this.collection().updateOne(
        {
          userId: ids.userId,
          integrationId: ids.integrationId,
          externalEventId: event.externalEventId
        },
        {
          $setOnInsert: {
            schemaVersion: 1 as const,
            userId: ids.userId,
            integrationId: ids.integrationId,
            externalEventId: event.externalEventId
          },
          $set: storedFields(event, now)
        },
        { upsert: true }
      );
    }

    if (deletedIds.length > 0) {
      await this.collection().deleteMany({
        userId: ids.userId,
        integrationId: ids.integrationId,
        externalEventId: { $in: [...deletedIds] }
      });
    }
  }

  async replaceWindow(
    userId: string,
    integrationId: string,
    events: readonly NormalizedEvent[],
    from: Date,
    to: Date,
    now: Date
  ): Promise<void> {
    await this.apply(userId, integrationId, events, [], now);
    const ids = idsOf(userId, integrationId);

    if (!ids) {
      return;
    }

    await this.collection().deleteMany({
      userId: ids.userId,
      integrationId: ids.integrationId,
      startAt: { $gte: from, $lt: to },
      externalEventId: { $nin: events.map((event) => event.externalEventId) }
    });
  }

  async listRange(userId: string, from: Date, to: Date): Promise<readonly StoredCalendarEvent[]> {
    const id = parseObjectId(userId);

    if (!id) {
      return [];
    }

    const documents = await this.collection()
      .find({
        userId: id,
        startAt: { $gte: new Date(from.getTime() - 24 * 60 * 60 * 1000), $lt: to }
      })
      .sort({ startAt: 1 })
      .limit(50)
      .toArray();

    return documents
      .filter((document) => document.endAt.getTime() > from.getTime())
      .map((document) => toStored(document));
  }

  async deleteForUser(userId: string): Promise<void> {
    const id = parseObjectId(userId);

    if (!id) {
      return;
    }

    await this.collection().deleteMany({ userId: id });
  }

  private collection() {
    return this.db.collection<CalendarEventDocument>("calendar_events");
  }
}

export class MemoryCalendarRepository implements CalendarRepository {
  private readonly events: StoredCalendarEvent[] = [];

  async apply(
    userId: string,
    integrationId: string,
    upserts: readonly NormalizedEvent[],
    deletedIds: readonly string[],
    now: Date
  ): Promise<void> {
    for (const event of upserts) {
      const index = this.events.findIndex(
        (item) =>
          item.userId === userId &&
          item.integrationId === integrationId &&
          item.externalEventId === event.externalEventId
      );
      const stored = toMemory(userId, integrationId, event, now, this.events[index]?.id);

      if (index === -1) {
        this.events.push(stored);
      } else {
        this.events[index] = stored;
      }
    }

    for (const externalEventId of deletedIds) {
      const index = this.events.findIndex(
        (item) =>
          item.userId === userId &&
          item.integrationId === integrationId &&
          item.externalEventId === externalEventId
      );

      if (index >= 0) {
        this.events.splice(index, 1);
      }
    }
  }

  async replaceWindow(
    userId: string,
    integrationId: string,
    events: readonly NormalizedEvent[],
    from: Date,
    to: Date,
    now: Date
  ): Promise<void> {
    await this.apply(userId, integrationId, events, [], now);
    const keep = new Set(events.map((event) => event.externalEventId));

    for (let index = this.events.length - 1; index >= 0; index -= 1) {
      const event = this.events[index];

      if (
        event &&
        event.userId === userId &&
        event.integrationId === integrationId &&
        event.startAt.getTime() >= from.getTime() &&
        event.startAt.getTime() < to.getTime() &&
        !keep.has(event.externalEventId)
      ) {
        this.events.splice(index, 1);
      }
    }
  }

  async listRange(userId: string, from: Date, to: Date): Promise<readonly StoredCalendarEvent[]> {
    return this.events
      .filter(
        (event) =>
          event.userId === userId &&
          event.startAt.getTime() < to.getTime() &&
          event.endAt.getTime() > from.getTime()
      )
      .sort((left, right) => left.startAt.getTime() - right.startAt.getTime());
  }

  async deleteForUser(userId: string): Promise<void> {
    for (let index = this.events.length - 1; index >= 0; index -= 1) {
      if (this.events[index]?.userId === userId) {
        this.events.splice(index, 1);
      }
    }
  }
}

function idsOf(
  userId: string,
  integrationId: string
): { userId: ObjectId; integrationId: ObjectId } | null {
  const user = parseObjectId(userId);
  const integration = parseObjectId(integrationId);

  if (!user || !integration) {
    return null;
  }

  return { userId: user, integrationId: integration };
}

function storedFields(
  event: NormalizedEvent,
  now: Date
): Omit<
  CalendarEventDocument,
  "_id" | "schemaVersion" | "userId" | "integrationId" | "externalEventId"
> {
  return {
    calendarName: CALENDAR_NAME,
    title: event.title,
    startAt: event.startAt,
    endAt: event.endAt,
    allDay: event.allDay,
    location: event.location,
    meetingUrl: event.meetingUrl,
    htmlLink: event.htmlLink,
    status: event.status,
    updatedAt: now
  };
}

function toStored(document: CalendarEventDocument): StoredCalendarEvent {
  return {
    id: document._id.toHexString(),
    userId: document.userId.toHexString(),
    integrationId: document.integrationId.toHexString(),
    externalEventId: document.externalEventId,
    calendarName: document.calendarName,
    title: document.title,
    startAt: document.startAt,
    endAt: document.endAt,
    allDay: document.allDay,
    location: document.location,
    meetingUrl: document.meetingUrl,
    htmlLink: document.htmlLink,
    status: document.status,
    updatedAt: document.updatedAt
  };
}

function toMemory(
  userId: string,
  integrationId: string,
  event: NormalizedEvent,
  now: Date,
  id = new ObjectId().toHexString()
): StoredCalendarEvent {
  return {
    id,
    userId,
    integrationId,
    calendarName: CALENDAR_NAME,
    updatedAt: now,
    ...event
  };
}

import { newEntityId } from "../../shared/public-id.js";
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

function toMemory(
  userId: string,
  integrationId: string,
  event: NormalizedEvent,
  now: Date,
  id = newEntityId()
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

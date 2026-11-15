import type { PrismaClient } from "../../generated/prisma/client.js";
import { parseUuid } from "../../shared/public-id.js";
import type { NormalizedEvent } from "./calendar-model.js";
import type { CalendarRepository, StoredCalendarEvent } from "./calendar.repository.js";

const CALENDAR_NAME = "Основной";
const DAY_MS = 24 * 60 * 60 * 1000;

export class PrismaCalendarRepository implements CalendarRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async apply(
    userId: string,
    integrationId: string,
    upserts: readonly NormalizedEvent[],
    deletedIds: readonly string[],
    now: Date
  ): Promise<void> {
    const ids = owned(userId, integrationId);

    if (!ids) {
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      for (const event of upserts) {
        await tx.calendarEvent.upsert({
          where: {
            integrationId_externalEventId: {
              integrationId: ids.integrationId,
              externalEventId: event.externalEventId
            }
          },
          create: {
            integrationId: ids.integrationId,
            userId: ids.userId,
            externalEventId: event.externalEventId,
            ...eventFields(event, now)
          },
          update: eventFields(event, now)
        });
      }

      if (deletedIds.length > 0) {
        await tx.calendarEvent.deleteMany({
          where: {
            userId: ids.userId,
            integrationId: ids.integrationId,
            externalEventId: { in: [...deletedIds] }
          }
        });
      }
    });
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
    const ids = owned(userId, integrationId);

    if (!ids) {
      return;
    }

    await this.prisma.calendarEvent.deleteMany({
      where: {
        userId: ids.userId,
        integrationId: ids.integrationId,
        startAt: { gte: from, lt: to },
        externalEventId: { notIn: events.map((event) => event.externalEventId) }
      }
    });
  }

  async listRange(userId: string, from: Date, to: Date): Promise<readonly StoredCalendarEvent[]> {
    const id = parseUuid(userId);

    if (!id) {
      return [];
    }

    const rows = await this.prisma.calendarEvent.findMany({
      where: {
        userId: id,
        startAt: { gte: new Date(from.getTime() - DAY_MS), lt: to }
      },
      orderBy: { startAt: "asc" },
      take: 50
    });
    return rows.filter((row) => row.endAt.getTime() > from.getTime()).map((row) => toStored(row));
  }

  async deleteForUser(userId: string): Promise<void> {
    const id = parseUuid(userId);

    if (!id) {
      return;
    }

    await this.prisma.calendarEvent.deleteMany({ where: { userId: id } });
  }
}

function owned(userId: string, integrationId: string) {
  const user = parseUuid(userId);
  const integration = parseUuid(integrationId);

  if (!user || !integration) {
    return null;
  }

  return { userId: user, integrationId: integration };
}

function eventFields(event: NormalizedEvent, now: Date) {
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

function toStored(row: {
  id: string;
  userId: string;
  integrationId: string;
  externalEventId: string;
  calendarName: string;
  title: string;
  startAt: Date;
  endAt: Date;
  allDay: boolean;
  location: string | null;
  meetingUrl: string | null;
  htmlLink: string;
  status: "confirmed" | "tentative";
  updatedAt: Date;
}): StoredCalendarEvent {
  return {
    id: row.id,
    userId: row.userId,
    integrationId: row.integrationId,
    externalEventId: row.externalEventId,
    calendarName: row.calendarName,
    title: row.title,
    startAt: row.startAt,
    endAt: row.endAt,
    allDay: row.allDay,
    location: row.location,
    meetingUrl: row.meetingUrl,
    htmlLink: row.htmlLink,
    status: row.status,
    updatedAt: row.updatedAt
  };
}

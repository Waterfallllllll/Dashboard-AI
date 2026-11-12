import { describe, expect, it } from "vitest";

import { CalendarSyncResetError } from "./calendar-model.js";
import { MemoryCalendarRepository } from "./calendar.repository.js";
import {
  CalendarService,
  type CalendarAccess,
  type CalendarIntegrationPort
} from "./calendar.service.js";
import type { CalendarGateway } from "./google-calendar-gateway.js";

const viewer = {
  userId: "a".repeat(24),
  sessionId: "session",
  timezone: "Europe/Moscow",
  timeFormat: "24" as const
};

describe("синхронизация календаря", () => {
  it("после 410 сбрасывает курсор и читает окно заново", async () => {
    let cursor: string | null = "expired-cursor";
    const seen: Array<string | null> = [];
    const integrations: CalendarIntegrationPort = {
      async state(): Promise<CalendarAccess> {
        return {
          integrationId: "b".repeat(24),
          status: "connected",
          lastSyncAt: new Date("2026-11-12T05:00:00.000Z"),
          syncCursor: cursor,
          accessToken: "ya29.secret",
          refreshToken: null,
          expiresAt: null
        };
      },
      async saveSync(_userId, next) {
        cursor = next;
      },
      async markRevoked() {
        return undefined;
      }
    };
    const gateway: CalendarGateway = {
      async listEvents(_credentials, query) {
        seen.push(query.syncToken);

        if (query.syncToken) {
          throw new CalendarSyncResetError();
        }

        return {
          events: [
            {
              id: "evt-1",
              status: "confirmed",
              summary: "План",
              htmlLink: "https://calendar.google.com/calendar/event?eid=evt",
              location: "",
              hangoutLink: "",
              meetingUrl: "",
              startDate: "",
              startDateTime: "2026-11-12T09:00:00+03:00",
              endDate: "",
              endDateTime: "2026-11-12T10:00:00+03:00"
            }
          ],
          nextPageToken: null,
          nextSyncToken: null,
          accessToken: null
        };
      }
    };
    const service = new CalendarService(
      new MemoryCalendarRepository(),
      integrations,
      gateway,
      {
        async limit() {
          return 5;
        }
      },
      () => new Date("2026-11-12T05:00:00.000Z")
    );

    const section = await service.sync(viewer, "2026-11-12");
    expect(seen).toEqual(["expired-cursor", null]);
    expect(cursor).toBeNull();
    expect(section.status).toBe("ready");

    if (section.status === "ready") {
      expect(section.events).toHaveLength(1);
      expect(section.events[0]?.title).toBe("План");
    }
  });
});

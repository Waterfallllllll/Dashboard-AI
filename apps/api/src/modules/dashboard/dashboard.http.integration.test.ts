import { CSRF_HEADER } from "@dashboard/contracts";
import request from "supertest";
import { describe, expect, it } from "vitest";

import {
  cookieHeader,
  createHarness,
  googleUser,
  login,
  origin
} from "../auth/auth.http.integration.test.js";

const preset = {
  mode: "pomodoro",
  workMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15
};

describe("дашборд, виджеты, рутины и таймер", () => {
  it("требует сессию и не смешивает данные двух пользователей", async () => {
    const { app, google } = createHarness();
    await request(app).get("/api/v1/dashboard?date=2026-11-11").expect(401);
    google.identities.set(
      "user-a",
      googleUser("google-a", "Илья", "https://lh3.googleusercontent.com/a/a")
    );
    google.identities.set(
      "user-b",
      googleUser("google-b", "Анна", "https://lh3.googleusercontent.com/a/b")
    );
    const cookieA = await login(app, google, "user-a");
    const cookieB = await login(app, google, "user-b");
    const sessionA = await request(app)
      .get("/api/v1/auth/session")
      .set("Cookie", cookieHeader(cookieA))
      .expect(200);
    const csrfA = sessionA.body.data.csrfToken as string;

    const preferences = await request(app)
      .get("/api/v1/widgets/preferences")
      .set("Cookie", cookieHeader(cookieA))
      .expect(200);
    expect(preferences.body.data.widgets).toHaveLength(6);
    expect(JSON.stringify(preferences.body)).not.toContain("enc:v1:");

    const version = preferences.body.data.widgets[0].version as number;
    const stale = await request(app)
      .patch("/api/v1/widgets/preferences")
      .set("Cookie", cookieHeader(cookieA))
      .set("Origin", origin)
      .set(CSRF_HEADER, csrfA)
      .send({
        widgets: preferences.body.data.widgets.map((widget: { version: number }) => ({
          ...widget,
          version: widget.version + 1,
          updatedAt: undefined
        }))
      })
      .expect(409);
    expect(stale.body.error.code).toBe("CONFLICT");
    expect(version).toBe(1);

    const created = await request(app)
      .post("/api/v1/routine-rules")
      .set("Cookie", cookieHeader(cookieA))
      .set("Origin", origin)
      .set(CSRF_HEADER, csrfA)
      .set("Idempotency-Key", "routine-http-01")
      .send({ title: "Зарядка", startDate: "2026-11-11", recurrence: { kind: "once" } })
      .expect(201);
    const replay = await request(app)
      .post("/api/v1/routine-rules")
      .set("Cookie", cookieHeader(cookieA))
      .set("Origin", origin)
      .set(CSRF_HEADER, csrfA)
      .set("Idempotency-Key", "routine-http-01")
      .send({ title: "Зарядка", startDate: "2026-11-11", recurrence: { kind: "once" } })
      .expect(200);
    expect(replay.body.data.id).toBe(created.body.data.id);

    const day = await request(app)
      .get("/api/v1/routines")
      .query({ date: "2026-11-11" })
      .set("Cookie", cookieHeader(cookieA))
      .expect(200);
    const occurrenceId = day.body.data.items[0].id as string;
    await request(app)
      .patch(`/api/v1/routine-occurrences/${occurrenceId}`)
      .set("Cookie", cookieHeader(cookieB))
      .set("Origin", origin)
      .set(CSRF_HEADER, csrfA)
      .send({ status: "done" })
      .expect(403);
    const sessionB = await request(app)
      .get("/api/v1/auth/session")
      .set("Cookie", cookieHeader(cookieB))
      .expect(200);
    const foreign = await request(app)
      .patch(`/api/v1/routine-occurrences/${occurrenceId}`)
      .set("Cookie", cookieHeader(cookieB))
      .set("Origin", origin)
      .set(CSRF_HEADER, sessionB.body.data.csrfToken)
      .send({ status: "done" })
      .expect(404);
    expect(foreign.body.error.code).toBe("NOT_FOUND");

    const started = await request(app)
      .post("/api/v1/timers")
      .set("Cookie", cookieHeader(cookieA))
      .set("Origin", origin)
      .set(CSRF_HEADER, csrfA)
      .send({ preset })
      .expect(201);
    expect(started.body.data.session.endsAt).toEqual(expect.any(String));
    expect(started.body.data.session.runStatus).toBe("running");
    const paused = await request(app)
      .patch(`/api/v1/timers/${started.body.data.session.id}`)
      .set("Cookie", cookieHeader(cookieA))
      .set("Origin", origin)
      .set(CSRF_HEADER, csrfA)
      .send({ action: "pause", version: started.body.data.session.version })
      .expect(200);
    expect(paused.body.data.session.runStatus).toBe("paused");
    expect(paused.body.data.session.endsAt).toBe(started.body.data.session.endsAt);

    const dashboard = await request(app)
      .get("/api/v1/dashboard")
      .query({ date: "2026-11-11" })
      .set("Cookie", cookieHeader(cookieA))
      .expect(200);
    expect(dashboard.body.data.weather.status).toBe("unavailable");
    expect(dashboard.body.data.calendar.status).toBe("unavailable");
    expect(dashboard.body.data.news.status).toBe("unavailable");
    expect(dashboard.body.data.routines.status).toBe("ready");
    expect(dashboard.body.data.timer.status).toBe("ready");
    expect(dashboard.body.data.timer.timer.session.runStatus).toBe("paused");
    expect(JSON.stringify(dashboard.body)).not.toContain("stack");

    const empty = await request(app)
      .get("/api/v1/routines")
      .query({ date: "2026-11-11" })
      .set("Cookie", cookieHeader(cookieB))
      .expect(200);
    expect(empty.body.data.items).toEqual([]);
  });
});

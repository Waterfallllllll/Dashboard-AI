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

describe("погода, новости и интеграции", () => {
  it("округляет точку, изолирует сбой провайдера и не отдаёт секрет OAuth", async () => {
    const { app, google } = createHarness();
    google.identities.set(
      "user-a",
      googleUser("google-a", "Илья", "https://lh3.googleusercontent.com/a/a")
    );
    const cookie = await login(app, google, "user-a");
    const session = await request(app)
      .get("/api/v1/auth/session")
      .set("Cookie", cookieHeader(cookie))
      .expect(200);
    const csrf = session.body.data.csrfToken as string;

    const denied = await request(app)
      .put("/api/v1/weather/location")
      .set("Cookie", cookieHeader(cookie))
      .set("Origin", origin)
      .send({ latitude: 55.755826, longitude: 37.6173, label: "Москва" })
      .expect(403);
    expect(denied.body.error.code).toBe("FORBIDDEN");

    const saved = await request(app)
      .put("/api/v1/weather/location")
      .set("Cookie", cookieHeader(cookie))
      .set("Origin", origin)
      .set(CSRF_HEADER, csrf)
      .send({ latitude: 55.755826, longitude: 37.6173, label: "Москва" })
      .expect(200);
    expect(saved.body.data.location).toEqual({
      latitude: 55.76,
      longitude: 37.62,
      label: "Москва"
    });
    expect(JSON.stringify(saved.body)).not.toContain("55.755826");

    const weather = await request(app)
      .get("/api/v1/weather")
      .set("Cookie", cookieHeader(cookie))
      .expect(200);
    expect(weather.body.data.status).toBe("error");
    expect(JSON.stringify(weather.body)).not.toContain("provider down");
    expect(JSON.stringify(weather.body)).not.toContain("55.755826");

    const connect = await request(app)
      .post("/api/v1/integrations/google/connect")
      .set("Cookie", cookieHeader(cookie))
      .set("Origin", origin)
      .set(CSRF_HEADER, csrf)
      .expect(200);
    expect(connect.body.data.url.startsWith("https://accounts.google.com/")).toBe(true);
    expect(connect.body.data.url).not.toContain("calendar-verifier-secret");
    expect(connect.body.data.url).not.toContain("code_verifier");
  });
});

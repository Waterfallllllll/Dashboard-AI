import { describe, expect, it } from "vitest";

import {
  calendarReturnMessage,
  integrationStatusLabel,
  isAllowedIntegrationUrl,
  parseCalendarReturn,
  syncSentence
} from "./integration-view";

describe("parseCalendarReturn", () => {
  it("принимает статусы возврата из Google", () => {
    expect(parseCalendarReturn("connected")).toBe("connected");
    expect(parseCalendarReturn("cancelled")).toBe("cancelled");
    expect(parseCalendarReturn(["error", "connected"])).toBe("error");
  });

  it("отбрасывает неизвестное значение", () => {
    expect(parseCalendarReturn("success")).toBeNull();
    expect(parseCalendarReturn(undefined)).toBeNull();
    expect(parseCalendarReturn([])).toBeNull();
    expect(calendarReturnMessage(null)).toBeNull();
    expect(calendarReturnMessage("error")).toBe(
      "Не удалось подключить календарь. Повторите попытку позже."
    );
  });
});

describe("isAllowedIntegrationUrl", () => {
  const hosts = ["t.me", "telegram.me", "accounts.google.com"] as const;

  it("пускает только https на точный хост", () => {
    expect(isAllowedIntegrationUrl("https://t.me/evergreen_bot?start=token", hosts)).toBe(true);
    expect(isAllowedIntegrationUrl("https://accounts.google.com/o/oauth2/v2/auth", hosts)).toBe(
      true
    );
  });

  it("отклоняет чужой хост, пароль в адресе и не-https", () => {
    expect(isAllowedIntegrationUrl("https://evil.t.me/bot", hosts)).toBe(false);
    expect(isAllowedIntegrationUrl("https://t.me.evil.com/bot", hosts)).toBe(false);
    expect(isAllowedIntegrationUrl("https://user:pass@t.me/bot", hosts)).toBe(false);
    expect(isAllowedIntegrationUrl("http://t.me/bot", hosts)).toBe(false);
    expect(isAllowedIntegrationUrl("not a url", hosts)).toBe(false);
  });
});

describe("integration status copy", () => {
  it("называет отозванный доступ отдельно от отключённого", () => {
    expect(integrationStatusLabel("revoked")).toBe("Доступ отозван");
    expect(integrationStatusLabel("connected")).toBe("Подключено");
    expect(integrationStatusLabel("disconnected")).toBe("Не подключено");
  });

  it("форматирует время синхронизации и молчит при пустой дате", () => {
    expect(syncSentence(null, "Europe/Moscow", Date.parse("2026-11-16T08:30:00.000Z"))).toBeNull();
    expect(
      syncSentence("2026-11-16T08:30:00.000Z", "Europe/Moscow", Date.parse("2026-11-16T09:00:00.000Z"))
    ).toBe("Последняя синхронизация сегодня в 11:30.");
  });
});

import { describe, expect, it } from "vitest";

import { parseLoginStatus } from "./login-status";

describe("parseLoginStatus", () => {
  it("принимает статусы OAuth-колбэка", () => {
    expect(parseLoginStatus("cancelled")).toBe("cancelled");
    expect(parseLoginStatus("error")).toBe("error");
    expect(parseLoginStatus("loading")).toBe("loading");
  });

  it("берёт первое значение из массива search params", () => {
    expect(parseLoginStatus(["error", "cancelled"])).toBe("error");
  });

  it("игнорирует неизвестный и пустой статус", () => {
    expect(parseLoginStatus("success")).toBeNull();
    expect(parseLoginStatus(undefined)).toBeNull();
    expect(parseLoginStatus([])).toBeNull();
  });
});

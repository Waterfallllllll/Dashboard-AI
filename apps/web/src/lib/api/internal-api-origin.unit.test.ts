import { describe, expect, it } from "vitest";

import { internalApiOrigin } from "./internal-api-origin";

describe("адрес внутреннего API", () => {
  it("использует локальный API, когда адрес не задан", () => {
    expect(internalApiOrigin(undefined)).toBe("http://localhost:4000");
    expect(internalApiOrigin("  ")).toBe("http://localhost:4000");
  });

  it("оставляет только origin", () => {
    expect(internalApiOrigin("http://localhost:4000/")).toBe("http://localhost:4000");
    expect(internalApiOrigin("https://api.example.com")).toBe("https://api.example.com");
  });

  it("отклоняет адрес с путём, параметрами или секретом", () => {
    expect(() => internalApiOrigin("http://user:secret@localhost:4000")).toThrow(
      /INTERNAL_API_URL/
    );
    expect(() => internalApiOrigin("http://localhost:4000/internal")).toThrow(/без пути/);
    expect(() => internalApiOrigin("http://localhost:4000?token=secret")).toThrow(/без пути/);
  });
});

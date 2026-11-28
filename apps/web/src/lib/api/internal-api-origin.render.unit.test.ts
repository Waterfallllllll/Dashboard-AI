import { describe, expect, it } from "vitest";

import { internalApiOrigin } from "./internal-api-origin";

describe("внутренний адрес API в Render", () => {
  it("добавляет http к private host:port из Blueprint", () => {
    expect(internalApiOrigin("evergreen-dashboard-api:10000")).toBe(
      "http://evergreen-dashboard-api:10000"
    );
  });
});

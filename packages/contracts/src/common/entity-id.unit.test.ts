import { describe, expect, it } from "vitest";

import { entityIdSchema } from "./primitives.js";

describe("идентификатор сущности", () => {
  it("принимает UUID PostgreSQL и прежний 24-символьный идентификатор", () => {
    const uuid = "3f1a6c2e-8b44-4d1a-9c3e-6a7b8c9d0e1f";

    expect(entityIdSchema.parse(uuid)).toBe(uuid);
    expect(entityIdSchema.parse("64b7f0c2a1d4e8f01a2b3c4d")).toBe("64b7f0c2a1d4e8f01a2b3c4d");
    expect(entityIdSchema.safeParse("3F1A6C2E-8B44-4D1A-9C3E-6A7B8C9D0E1F").success).toBe(false);
    expect(entityIdSchema.safeParse("64b7f0c2a1d4e8f01a2b3c4").success).toBe(false);
  });
});

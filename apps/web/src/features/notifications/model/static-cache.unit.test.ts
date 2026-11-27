import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

describe("кэш статики service worker", () => {
  it("хранит только ответы, которые сервер пометил как неизменяемые", () => {
    const source = readFileSync(new URL("../../../../public/sw.js", import.meta.url), "utf8");

    expect(source).toContain("evergreen-static-v2");
    expect(source).toContain('includes("immutable")');
    expect(source).not.toContain("evergreen-static-v1");
  });
});

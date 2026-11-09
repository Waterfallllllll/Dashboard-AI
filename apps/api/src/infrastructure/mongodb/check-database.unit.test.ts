import { describe, expect, it } from "vitest";

import { formatDatabaseCheck } from "./check-database.js";

describe("отчёт проверки базы", () => {
  it("показывает имя запроса и код нарушения без содержимого документов", () => {
    const report = formatDatabaseCheck({
      ok: false,
      queries: [
        {
          name: "session-by-token-hash",
          collection: "sessions",
          expectedIndex: "sessions_token_hash",
          ok: false,
          indexName: null,
          stages: ["COLLSCAN"],
          reason: "план читает коллекцию целиком"
        }
      ],
      integrity: {
        ok: false,
        scanned: { users: 1 },
        truncated: true,
        violations: [
          { code: "ORPHAN_USER", collection: "sessions", documentId: "64b0a0a0a0a0a0a0a0a0a0a0" }
        ]
      }
    });

    expect(report).toContain("session-by-token-hash");
    expect(report).toContain("ORPHAN_USER");
    expect(report).toContain("Список нарушений обрезан.");
    expect(report).not.toContain("tokenHash");
  });
});

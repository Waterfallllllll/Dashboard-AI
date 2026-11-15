import { describe, expect, it } from "vitest";

import {
  EXPIRED_ROW_BATCH,
  EXPIRED_ROW_TABLES,
  assertExpiredRowCoverage,
  expiredRowStatements
} from "./expired-rows.js";
import { UNTIL_ACCOUNT_PURGE, WORKER_DELETE_POLICIES } from "./retention.js";

const now = new Date("2026-11-15T12:00:00.000Z");
const SECRET_COLUMNS = ["token_hash", "credentials", "payload", "access_token", "refresh_token"];

describe("очистка просроченных строк", () => {
  it("покрывает только таблицы, которые worker удаляет по сроку", () => {
    expect(() => assertExpiredRowCoverage()).not.toThrow();
    expect([...EXPIRED_ROW_TABLES]).toEqual(WORKER_DELETE_POLICIES.map((policy) => policy.table));

    for (const table of UNTIL_ACCOUNT_PURGE) {
      expect(EXPIRED_ROW_TABLES).not.toContain(table);
    }

    expect(EXPIRED_ROW_TABLES).not.toContain("news_items");
  });

  it("удаляет по индексу срока и не читает секретные колонки", () => {
    const statements = expiredRowStatements(now);

    expect(sqlText(statements.sessions)).toContain('"expires_at" <=');
    expect(sqlText(statements.one_time_tokens)).toContain('"expires_at" <=');
    expect(sqlText(statements.notification_deliveries)).toContain('"delete_at" <=');
    expect(sqlText(statements.audit_events)).toContain('"delete_at" <=');
    expect(sqlText(statements.scheduled_jobs)).toContain(`'completed'::"job_status"`);
    expect(sqlText(statements.scheduled_jobs)).toContain(`'failed'::"job_status"`);
    expect(sqlText(statements.scheduled_jobs)).toContain(`'scheduler-lock'`);
    expect(sqlText(statements.scheduled_jobs)).toContain(`'worker-heartbeat'`);
    expect(sqlText(statements.scheduled_jobs)).toContain("NOT IN");

    for (const statement of Object.values(statements)) {
      expect(statement.values).toEqual([now, EXPIRED_ROW_BATCH]);
      const text = sqlText(statement);

      for (const column of SECRET_COLUMNS) {
        expect(text).not.toContain(column);
      }
    }
  });
});

function sqlText(statement: { readonly strings: readonly string[] }): string {
  return statement.strings.join(" ");
}

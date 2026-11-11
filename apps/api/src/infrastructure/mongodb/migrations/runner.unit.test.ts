import { describe, expect, it } from "vitest";

import { MIGRATIONS, planMigrations } from "./registry.js";
import type { Migration } from "./types.js";

const migrations: readonly Migration[] = [
  { version: 1, name: "first-step", up: async () => undefined },
  { version: 2, name: "second-step", up: async () => undefined }
];

describe("план миграций", () => {
  it("применяет версии по порядку и пропускает уже записанные", () => {
    expect(MIGRATIONS.map((migration) => [migration.version, migration.name])).toEqual([
      [1, "initial-indexes"],
      [2, "one-time-tokens"]
    ]);
    expect(planMigrations([], migrations).apply.map((migration) => migration.version)).toEqual([
      1, 2
    ]);
    expect(planMigrations([1], migrations).apply.map((migration) => migration.version)).toEqual([
      2
    ]);
    expect(planMigrations([1, 2], migrations).apply).toEqual([]);
    expect(planMigrations([1, 2], migrations).skip.map((migration) => migration.version)).toEqual([
      1, 2
    ]);
  });

  it("останавливается на неизвестной версии, пропуске и миграции не по порядку", () => {
    expect(() => planMigrations([4], migrations)).toThrow(/неизвестные миграции/);
    expect(() => planMigrations([2], migrations)).toThrow(/раньше предыдущих/);
    expect(() =>
      planMigrations(
        [],
        [
          { version: 1, name: "first-step", up: async () => undefined },
          { version: 3, name: "third-step", up: async () => undefined }
        ]
      )
    ).toThrow(/без пропусков/);
  });
});

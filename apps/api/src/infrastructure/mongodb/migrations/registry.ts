import { initialIndexesMigration } from "./0001-initial-indexes.js";
import { oneTimeTokensMigration } from "./0002-one-time-tokens.js";
import type { Migration, MigrationPlan } from "./types.js";

export const MIGRATIONS: readonly Migration[] = [initialIndexesMigration, oneTimeTokensMigration];

const MIGRATION_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function assertMigrationRegistry(migrations: readonly Migration[]): void {
  if (migrations.length === 0) {
    throw new Error("Нет миграций");
  }

  const names = new Set<string>();

  migrations.forEach((migration, index) => {
    if (migration.version !== index + 1) {
      throw new Error("Миграции должны идти с версии 1 без пропусков");
    }

    if (!MIGRATION_NAME.test(migration.name) || migration.name.length > 80) {
      throw new Error(`Некорректное имя миграции: ${migration.name}`);
    }

    if (names.has(migration.name)) {
      throw new Error(`Повторяющееся имя миграции: ${migration.name}`);
    }

    names.add(migration.name);
  });
}

export function planMigrations(
  appliedVersions: readonly number[],
  migrations: readonly Migration[] = MIGRATIONS
): MigrationPlan {
  assertMigrationRegistry(migrations);
  const known = new Set(migrations.map((migration) => migration.version));
  const unknown = appliedVersions.filter((version) => !known.has(version));

  if (unknown.length > 0) {
    throw new Error(`В базе есть неизвестные миграции: ${unknown.join(", ")}`);
  }

  const applied = new Set(appliedVersions);
  const apply: Migration[] = [];
  const skip: Migration[] = [];
  let seenUnapplied = false;

  for (const migration of migrations) {
    if (applied.has(migration.version)) {
      if (seenUnapplied) {
        throw new Error(`Миграция ${migration.version} применена раньше предыдущих`);
      }

      skip.push(migration);
      continue;
    }

    seenUnapplied = true;
    apply.push(migration);
  }

  return { apply, skip };
}

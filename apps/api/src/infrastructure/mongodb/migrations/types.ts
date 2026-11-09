import type { Db } from "mongodb";

export type Migration = {
  readonly version: number;
  readonly name: string;
  readonly up: (db: Db) => Promise<void>;
};

export type MigrationPlan = {
  readonly apply: readonly Migration[];
  readonly skip: readonly Migration[];
};

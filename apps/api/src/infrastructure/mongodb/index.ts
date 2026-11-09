export {
  COLLECTION_DEFINITIONS,
  COLLECTION_NAMES,
  getCollectionDefinition,
  type AuthAccountDocument,
  type CollectionDefinition,
  type CollectionName,
  type DashboardConfigDocument,
  type IntegrationDocument,
  type NewsItemDocument,
  type NotificationDeliveryDocument,
  type PushSubscriptionDocument,
  type RoutineOccurrenceDocument,
  type RoutineRuleDocument,
  type SessionDocument,
  type TimerSessionDocument,
  type UserDocument
} from "./collection-catalog.js";
export { ensureCollections, type EnsureCollectionsResult } from "./ensure-collections.js";
export { ensureIndexes, type EnsureIndexesResult } from "./ensure-indexes.js";
export {
  INDEX_DEFINITIONS,
  assertIndexCatalog,
  type IndexDefinition,
  type IndexKind,
  type PartialFilter
} from "./index-catalog.js";
export { closeMongo, connectMongo, readMongoConfig, type MongoConfig } from "./mongo-client.js";
export { MIGRATIONS, assertMigrationRegistry, planMigrations } from "./migrations/registry.js";
export {
  SCHEMA_MIGRATIONS_COLLECTION,
  SCHEMA_MIGRATIONS_VERSION_INDEX,
  runMigrations,
  type MigrateResult
} from "./migrations/runner.js";
export { AccountStillActiveError, purgeAccount } from "./account-purge.js";
export { checkDatabase, formatDatabaseCheck } from "./check-database.js";
export {
  INDEX_USED_REASON,
  PLANNER_SAMPLE_MIN_DOCUMENTS,
  SMALL_COLLECTION_REASON,
  explainMainQueries
} from "./explain-query.js";
export { checkDataIntegrity } from "./integrity.js";
export { assertQueryCatalog, buildMainQueries, createQuerySample } from "./query-catalog.js";
export {
  DEFAULT_NOTIFICATION_RETENTION_DAYS,
  HISTORY_POLICIES,
  assertHistoryRetention,
  deliveryRetentionViolation,
  notificationDeleteAt
} from "./retention.js";
export { GLOBAL_COLLECTIONS, USER_OWNED_COLLECTIONS, assertUserDataCoverage } from "./user-data.js";
export {
  activeDocumentFilter,
  restoreFields,
  restoreSoftDeletedById,
  softDeleteById,
  softDeleteFields,
  type RestoreResult,
  type SoftDeleteResult,
  type SoftDeletableDocument
} from "./soft-delete.js";

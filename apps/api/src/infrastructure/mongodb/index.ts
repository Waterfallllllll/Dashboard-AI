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
export { closeMongo, connectMongo, readMongoConfig, type MongoConfig } from "./mongo-client.js";

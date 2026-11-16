-- Index the sessions foreign key. Cascade delete and lookup by user were sequential scans.
CREATE INDEX "sessions_user_id" ON "sessions"("user_id");

-- Partial index for the worker reminder scan. Equality filters live in the predicate.
CREATE INDEX "routine_rules_active_reminders" ON "routine_rules"("reminder_local_time") WHERE "deleted_at" IS NULL AND "status" = 'active'::"routine_status" AND "reminder_local_time" IS NOT NULL;

-- New rows get time-ordered UUID v7. Existing UUID v4 values stay as they are.
ALTER TABLE "users" ALTER COLUMN "id" SET DEFAULT uuidv7();
ALTER TABLE "auth_accounts" ALTER COLUMN "id" SET DEFAULT uuidv7();
ALTER TABLE "sessions" ALTER COLUMN "id" SET DEFAULT uuidv7();
ALTER TABLE "one_time_tokens" ALTER COLUMN "id" SET DEFAULT uuidv7();
ALTER TABLE "widget_preferences" ALTER COLUMN "id" SET DEFAULT uuidv7();
ALTER TABLE "routine_rules" ALTER COLUMN "id" SET DEFAULT uuidv7();
ALTER TABLE "routine_occurrences" ALTER COLUMN "id" SET DEFAULT uuidv7();
ALTER TABLE "timer_presets" ALTER COLUMN "id" SET DEFAULT uuidv7();
ALTER TABLE "integrations" ALTER COLUMN "id" SET DEFAULT uuidv7();
ALTER TABLE "calendar_events" ALTER COLUMN "id" SET DEFAULT uuidv7();
ALTER TABLE "news_items" ALTER COLUMN "id" SET DEFAULT uuidv7();
ALTER TABLE "push_subscriptions" ALTER COLUMN "id" SET DEFAULT uuidv7();
ALTER TABLE "scheduled_jobs" ALTER COLUMN "id" SET DEFAULT uuidv7();
ALTER TABLE "notification_deliveries" ALTER COLUMN "id" SET DEFAULT uuidv7();
ALTER TABLE "audit_events" ALTER COLUMN "id" SET DEFAULT uuidv7();
ALTER TABLE "timer_sessions" ALTER COLUMN "id" SET DEFAULT uuidv7();

-- The application role owns the schema. PUBLIC no longer has usage or create.
REVOKE ALL ON SCHEMA public FROM PUBLIC;

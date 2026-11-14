-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "time_format" AS ENUM ('12', '24');

-- CreateEnum
CREATE TYPE "theme_preference" AS ENUM ('system', 'light', 'dark');

-- CreateEnum
CREATE TYPE "auth_provider" AS ENUM ('google', 'telegram');

-- CreateEnum
CREATE TYPE "one_time_token_purpose" AS ENUM ('oauth_state', 'calendar_oauth', 'telegram_link');

-- CreateEnum
CREATE TYPE "widget_type" AS ENUM ('datetime', 'weather', 'calendar', 'routines', 'timer', 'news');

-- CreateEnum
CREATE TYPE "widget_size" AS ENUM ('compact', 'standard', 'wide', 'full');

-- CreateEnum
CREATE TYPE "recurrence_kind" AS ENUM ('daily', 'weekdays', 'weekly', 'once');

-- CreateEnum
CREATE TYPE "routine_status" AS ENUM ('active', 'paused', 'ended');

-- CreateEnum
CREATE TYPE "occurrence_status" AS ENUM ('pending', 'done', 'hidden');

-- CreateEnum
CREATE TYPE "timer_mode" AS ENUM ('pomodoro', 'custom', 'manual');

-- CreateEnum
CREATE TYPE "timer_run_status" AS ENUM ('idle', 'running', 'paused');

-- CreateEnum
CREATE TYPE "timer_phase" AS ENUM ('work', 'short-break', 'long-break');

-- CreateEnum
CREATE TYPE "integration_type" AS ENUM ('google_calendar', 'telegram');

-- CreateEnum
CREATE TYPE "integration_status" AS ENUM ('disconnected', 'connected', 'revoked');

-- CreateEnum
CREATE TYPE "calendar_event_status" AS ENUM ('confirmed', 'tentative');

-- CreateEnum
CREATE TYPE "notification_event_type" AS ENUM ('work', 'break', 'routine', 'calendar');

-- CreateEnum
CREATE TYPE "notification_channel" AS ENUM ('browser', 'telegram', 'in_app');

-- CreateEnum
CREATE TYPE "delivery_status" AS ENUM ('pending', 'sent', 'failed', 'skipped');

-- CreateEnum
CREATE TYPE "scheduled_job_type" AS ENUM ('timer-due', 'deliver-notification', 'refresh-news', 'sync-calendar', 'scan-due-timers', 'scan-routine-reminders', 'purge-revoked-push', 'renew-calendar-watch', 'scheduler-lock', 'worker-heartbeat');

-- CreateEnum
CREATE TYPE "job_status" AS ENUM ('pending', 'processing', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "audit_action" AS ENUM ('login', 'logout', 'integration_connected', 'integration_disconnected', 'account_deleted');

-- CreateEnum
CREATE TYPE "audit_target" AS ENUM ('google', 'google_calendar', 'telegram');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "display_name" VARCHAR(120) NOT NULL,
    "avatar_url" VARCHAR(2048),
    "locale" VARCHAR(35) NOT NULL,
    "timezone" VARCHAR(64) NOT NULL,
    "time_format" "time_format" NOT NULL DEFAULT '24',
    "theme" "theme_preference" NOT NULL DEFAULT 'system',
    "weather_latitude" DECIMAL(5,2),
    "weather_longitude" DECIMAL(6,2),
    "weather_label" VARCHAR(80),
    "notification_settings" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_accounts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "provider" "auth_provider" NOT NULL,
    "provider_user_id" VARCHAR(128) NOT NULL,
    "access_token" TEXT,
    "refresh_token" TEXT,
    "scope" TEXT[],
    "expires_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "auth_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "token_hash" VARCHAR(128) NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMPTZ,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "one_time_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "token_hash" VARCHAR(128) NOT NULL,
    "purpose" "one_time_token_purpose" NOT NULL,
    "payload" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consumed_at" TIMESTAMPTZ,

    CONSTRAINT "one_time_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "widget_preferences" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "widget_type" "widget_type" NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "position" INTEGER NOT NULL,
    "size" "widget_size" NOT NULL,
    "settings" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "widget_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "routine_rules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "description" VARCHAR(500),
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "recurrence_kind" "recurrence_kind" NOT NULL,
    "recurrence_days" INTEGER[],
    "reminder_local_time" VARCHAR(5),
    "timezone" VARCHAR(64) NOT NULL,
    "status" "routine_status" NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "routine_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "routine_occurrences" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "routine_rule_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "local_date" DATE NOT NULL,
    "title_override" VARCHAR(120),
    "status" "occurrence_status" NOT NULL,
    "completed_at" TIMESTAMPTZ,
    "excluded_at" TIMESTAMPTZ,

    CONSTRAINT "routine_occurrences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timer_presets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "mode" "timer_mode" NOT NULL,
    "work_minutes" INTEGER NOT NULL,
    "short_break_minutes" INTEGER NOT NULL,
    "long_break_minutes" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "timer_presets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timer_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "mode" "timer_mode" NOT NULL,
    "work_minutes" INTEGER NOT NULL,
    "short_break_minutes" INTEGER NOT NULL,
    "long_break_minutes" INTEGER NOT NULL,
    "run_status" "timer_run_status" NOT NULL,
    "phase" "timer_phase" NOT NULL,
    "started_at" TIMESTAMPTZ,
    "paused_at" TIMESTAMPTZ,
    "ends_at" TIMESTAMPTZ,
    "completed_at" TIMESTAMPTZ,
    "cycle_number" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "timer_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integrations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "type" "integration_type" NOT NULL,
    "status" "integration_status" NOT NULL,
    "credentials" TEXT,
    "scope" TEXT[],
    "external_user_id" VARCHAR(128),
    "last_sync_at" TIMESTAMPTZ,
    "sync_cursor" TEXT,
    "watch_channel_id" VARCHAR(256),
    "watch_resource_id" VARCHAR(256),
    "watch_expires_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "integration_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "external_event_id" VARCHAR(1024) NOT NULL,
    "calendar_name" VARCHAR(256) NOT NULL,
    "title" VARCHAR(1024) NOT NULL,
    "start_at" TIMESTAMPTZ NOT NULL,
    "end_at" TIMESTAMPTZ NOT NULL,
    "all_day" BOOLEAN NOT NULL,
    "location" VARCHAR(512),
    "meeting_url" VARCHAR(2048),
    "html_link" VARCHAR(2048) NOT NULL,
    "status" "calendar_event_status" NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "calendar_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "news_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "source" VARCHAR(256) NOT NULL,
    "title" VARCHAR(512) NOT NULL,
    "excerpt" VARCHAR(2000) NOT NULL,
    "canonical_url" VARCHAR(2048) NOT NULL,
    "content_hash" VARCHAR(128) NOT NULL,
    "published_at" TIMESTAMPTZ NOT NULL,
    "language" VARCHAR(35) NOT NULL,
    "topics" TEXT[],
    "image_url" VARCHAR(2048),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "news_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_subscriptions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "endpoint_hash" VARCHAR(128) NOT NULL,
    "endpoint" TEXT NOT NULL,
    "keys" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMPTZ,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduled_jobs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "type" "scheduled_job_type" NOT NULL,
    "payload" JSONB NOT NULL,
    "run_at" TIMESTAMPTZ NOT NULL,
    "status" "job_status" NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL,
    "idempotency_key" VARCHAR(200) NOT NULL,
    "locked_by" VARCHAR(64),
    "locked_at" TIMESTAMPTZ,
    "lock_expires_at" TIMESTAMPTZ,
    "last_error" VARCHAR(500),
    "user_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "delete_at" TIMESTAMPTZ,

    CONSTRAINT "scheduled_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_deliveries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "event_type" "notification_event_type" NOT NULL,
    "channel" "notification_channel" NOT NULL,
    "idempotency_key" VARCHAR(200) NOT NULL,
    "status" "delivery_status" NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "provider_message_id" VARCHAR(256),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "delete_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "notification_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID,
    "action" "audit_action" NOT NULL,
    "target" "audit_target",
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "delete_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "auth_accounts_provider_identity" ON "auth_accounts"("provider", "provider_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "auth_accounts_user_provider" ON "auth_accounts"("user_id", "provider");

-- CreateIndex
CREATE INDEX "sessions_expires_at" ON "sessions"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_hash" ON "sessions"("token_hash");

-- CreateIndex
CREATE INDEX "one_time_tokens_expires_at" ON "one_time_tokens"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "one_time_tokens_token_hash" ON "one_time_tokens"("token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "widget_preferences_user_type" ON "widget_preferences"("user_id", "widget_type");

-- CreateIndex
CREATE UNIQUE INDEX "widget_preferences_user_position" ON "widget_preferences"("user_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "routine_rules_id_user" ON "routine_rules"("id", "user_id");

-- CreateIndex
CREATE INDEX "routine_occurrences_user_date" ON "routine_occurrences"("user_id", "local_date");

-- CreateIndex
CREATE UNIQUE INDEX "routine_occurrences_rule_date" ON "routine_occurrences"("routine_rule_id", "local_date");

-- CreateIndex
CREATE UNIQUE INDEX "timer_presets_user" ON "timer_presets"("user_id");

-- CreateIndex
CREATE INDEX "timer_sessions_user_started_at" ON "timer_sessions"("user_id", "started_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "integrations_id_user" ON "integrations"("id", "user_id");

-- CreateIndex
CREATE INDEX "calendar_events_user_start" ON "calendar_events"("user_id", "start_at");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_events_integration_external" ON "calendar_events"("integration_id", "external_event_id");

-- CreateIndex
CREATE INDEX "news_items_published_language" ON "news_items"("published_at" DESC, "language");

-- CreateIndex
CREATE INDEX "news_items_topics" ON "news_items" USING GIN ("topics");

-- CreateIndex
CREATE UNIQUE INDEX "news_items_content_hash" ON "news_items"("content_hash");

-- CreateIndex
CREATE INDEX "push_subscriptions_user_revoked" ON "push_subscriptions"("user_id", "revoked_at");

-- CreateIndex
CREATE INDEX "push_subscriptions_revoked_at" ON "push_subscriptions"("revoked_at");

-- CreateIndex
CREATE UNIQUE INDEX "push_subscriptions_endpoint_hash" ON "push_subscriptions"("endpoint_hash");

-- CreateIndex
CREATE INDEX "scheduled_jobs_status_run_at" ON "scheduled_jobs"("status", "run_at");

-- CreateIndex
CREATE INDEX "scheduled_jobs_status_lock" ON "scheduled_jobs"("status", "lock_expires_at");

-- CreateIndex
CREATE INDEX "scheduled_jobs_user_status" ON "scheduled_jobs"("user_id", "status");

-- CreateIndex
CREATE INDEX "scheduled_jobs_type_updated" ON "scheduled_jobs"("type", "updated_at" DESC);

-- CreateIndex
CREATE INDEX "scheduled_jobs_delete_at" ON "scheduled_jobs"("delete_at");

-- CreateIndex
CREATE UNIQUE INDEX "scheduled_jobs_idempotency_key" ON "scheduled_jobs"("idempotency_key");

-- CreateIndex
CREATE INDEX "notification_deliveries_user_created" ON "notification_deliveries"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "notification_deliveries_delete_at" ON "notification_deliveries"("delete_at");

-- CreateIndex
CREATE UNIQUE INDEX "notification_deliveries_idempotency_key" ON "notification_deliveries"("idempotency_key");

-- CreateIndex
CREATE INDEX "audit_events_user_created" ON "audit_events"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_events_delete_at" ON "audit_events"("delete_at");

-- AddForeignKey
ALTER TABLE "auth_accounts" ADD CONSTRAINT "auth_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "widget_preferences" ADD CONSTRAINT "widget_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routine_rules" ADD CONSTRAINT "routine_rules_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routine_occurrences" ADD CONSTRAINT "routine_occurrences_routine_rule_id_user_id_fkey" FOREIGN KEY ("routine_rule_id", "user_id") REFERENCES "routine_rules"("id", "user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timer_presets" ADD CONSTRAINT "timer_presets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timer_sessions" ADD CONSTRAINT "timer_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integrations" ADD CONSTRAINT "integrations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_integration_id_user_id_fkey" FOREIGN KEY ("integration_id", "user_id") REFERENCES "integrations"("id", "user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_jobs" ADD CONSTRAINT "scheduled_jobs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- PartialIndex
CREATE INDEX "routine_rules_user_status" ON "routine_rules"("user_id", "status") WHERE "deleted_at" IS NULL;

-- PartialIndex
CREATE INDEX "routine_rules_user_start_date" ON "routine_rules"("user_id", "start_date") WHERE "deleted_at" IS NULL;

-- PartialIndex
CREATE UNIQUE INDEX "timer_sessions_one_active_user" ON "timer_sessions"("user_id") WHERE "completed_at" IS NULL;

-- PartialIndex
CREATE UNIQUE INDEX "integrations_user_type" ON "integrations"("user_id", "type") WHERE "deleted_at" IS NULL;

-- PartialIndex
CREATE INDEX "scheduled_jobs_pending_run_at" ON "scheduled_jobs"("run_at") WHERE "status" = 'pending'::"job_status";

-- CiphertextCheck
ALTER TABLE "auth_accounts" ADD CONSTRAINT "auth_accounts_access_token_ciphertext" CHECK ("access_token" IS NULL OR (char_length("access_token") <= 8192 AND "access_token" ~ '^enc:v1:[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{2,}$'));

-- CiphertextCheck
ALTER TABLE "auth_accounts" ADD CONSTRAINT "auth_accounts_refresh_token_ciphertext" CHECK ("refresh_token" IS NULL OR (char_length("refresh_token") <= 8192 AND "refresh_token" ~ '^enc:v1:[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{2,}$'));

-- CiphertextCheck
ALTER TABLE "integrations" ADD CONSTRAINT "integrations_credentials_ciphertext" CHECK ("credentials" IS NULL OR (char_length("credentials") <= 8192 AND "credentials" ~ '^enc:v1:[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{2,}$'));

-- CiphertextCheck
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_keys_ciphertext" CHECK (char_length("keys") <= 8192 AND "keys" ~ '^enc:v1:[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{2,}$');

-- CiphertextCheck
ALTER TABLE "one_time_tokens" ADD CONSTRAINT "one_time_tokens_payload_ciphertext" CHECK (char_length("payload") <= 8192 AND "payload" ~ '^enc:v1:[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{2,}$');

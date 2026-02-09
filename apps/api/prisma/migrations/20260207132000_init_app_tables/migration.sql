DO $$
BEGIN
  CREATE TYPE "Plan" AS ENUM ('FREE', 'PREMIUM');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "users" (
    "id" TEXT NOT NULL,
    "external_key" TEXT NOT NULL,
    "email" TEXT,
    "name" TEXT,
    "plan" "Plan" NOT NULL DEFAULT 'FREE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "users_external_key_key" ON "users"("external_key");

CREATE TABLE IF NOT EXISTS "subscriptions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "stripe_customer_id" TEXT,
    "stripe_subscription_id" TEXT,
    "status" TEXT NOT NULL,
    "plan" "Plan",
    "current_period_end" TIMESTAMP(3),
    "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "subscriptions_stripe_subscription_id_key" ON "subscriptions"("stripe_subscription_id");
CREATE INDEX IF NOT EXISTS "subscriptions_user_id_idx" ON "subscriptions"("user_id");
CREATE INDEX IF NOT EXISTS "subscriptions_stripe_customer_id_idx" ON "subscriptions"("stripe_customer_id");

CREATE TABLE IF NOT EXISTS "entitlements" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "plan" "Plan" NOT NULL,
    "qa_daily_limit" INTEGER NOT NULL DEFAULT 5,
    "qa_row_limit" INTEGER NOT NULL DEFAULT 100,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "entitlements_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "entitlements_user_id_key" ON "entitlements"("user_id");

CREATE TABLE IF NOT EXISTS "usage_daily" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "usage_date" TEXT NOT NULL,
    "qa_queries" INTEGER NOT NULL DEFAULT 0,
    "api_requests" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usage_daily_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "usage_daily_user_id_usage_date_key" ON "usage_daily"("user_id", "usage_date");
CREATE INDEX IF NOT EXISTS "usage_daily_usage_date_idx" ON "usage_daily"("usage_date");

CREATE TABLE IF NOT EXISTS "query_history" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "intent" TEXT NOT NULL,
    "parameters" JSONB,
    "limited" BOOLEAN NOT NULL DEFAULT false,
    "response_summary" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "query_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "query_history_user_id_created_at_idx" ON "query_history"("user_id", "created_at");

CREATE TABLE IF NOT EXISTS "saved_items" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "item_type" TEXT NOT NULL,
    "item_ref" TEXT NOT NULL,
    "payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "saved_items_user_id_item_type_idx" ON "saved_items"("user_id", "item_type");

CREATE TABLE IF NOT EXISTS "audit_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "actor_key" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "audit_logs_actor_key_created_at_idx" ON "audit_logs"("actor_key", "created_at");

DO $$
BEGIN
  ALTER TABLE "subscriptions"
    ADD CONSTRAINT "subscriptions_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "entitlements"
    ADD CONSTRAINT "entitlements_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "usage_daily"
    ADD CONSTRAINT "usage_daily_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "query_history"
    ADD CONSTRAINT "query_history_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "saved_items"
    ADD CONSTRAINT "saved_items_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "audit_logs"
    ADD CONSTRAINT "audit_logs_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "password_hash" TEXT;

UPDATE "users"
SET "email" = LOWER(TRIM("email"))
WHERE "email" IS NOT NULL;

WITH normalized AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "email"
      ORDER BY "created_at" ASC, "id" ASC
    ) AS rn
  FROM "users"
  WHERE "email" IS NOT NULL
)
UPDATE "users"
SET "email" = NULL
WHERE "id" IN (
  SELECT "id"
  FROM normalized
  WHERE rn > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS "users_email_key" ON "users"("email");

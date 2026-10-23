-- Align existing profiles and database uniqueness with normalizeEmail.
-- Abort atomically if legacy active profiles collide after normalization;
-- resolve those identities explicitly rather than silently merging/deleting them.
BEGIN;
DROP INDEX "profiles_email_active_key";
CREATE UNIQUE INDEX "profiles_email_active_key"
  ON "profiles" (lower(btrim("email")))
  WHERE "deleted_at" IS NULL;
UPDATE "profiles" SET "email" = lower(btrim("email"))
  WHERE "email" IS DISTINCT FROM lower(btrim("email"));
COMMIT;

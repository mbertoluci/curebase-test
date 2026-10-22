-- Enforce "one active profile per email" while still allowing a soft-deleted
-- email to be re-registered. A plain UNIQUE constraint cannot do this, so we use
-- a PARTIAL unique index scoped to non-deleted rows. This is the integrity
-- guarantee behind the create flow's 409-on-duplicate behaviour.
CREATE UNIQUE INDEX "profiles_email_active_key"
  ON "profiles" ("email")
  WHERE "deleted_at" IS NULL;

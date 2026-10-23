-- Rename the audit table to the plural convention used by every other table
-- (users/profiles/participants). The Prisma model stays `AuditLog`, so the
-- client delegate (`auditLog`) is unchanged - only the physical table name.
ALTER TABLE "audit_log" RENAME TO "audit_logs";

-- `action` is a closed set; enforce it at the database (B2) so a bad write
-- (even by raw SQL) cannot land. `entity` stays free text: it grows per feature.
ALTER TABLE "audit_logs"
  ADD CONSTRAINT "audit_logs_action_check"
  CHECK ("action" IN ('CREATE', 'UPDATE', 'DELETE'));

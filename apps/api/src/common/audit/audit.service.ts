import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

/** The closed set of audited mutations (mirrors the DB CHECK on `action`). */
export enum AuditAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
}

/** The entities that can be audited (grows as features are added). */
export enum AuditEntity {
  PARTICIPANT = 'participant',
}

export interface AuditEntry {
  actor: string;
  action: AuditAction;
  entity: AuditEntity;
  entityId: string;
  before?: unknown;
  after?: unknown;
}

/**
 * Writes the append-only audit trail. `record` takes a Prisma transaction client
 * so the audit row is committed atomically with the mutation it describes - there
 * is never a data change without its audit entry, nor an entry for a rolled-back
 * change. before/after keep the real values (PII included) on purpose; this table
 * is access-controlled and never echoed to logs.
 */
@Injectable()
export class AuditService {
  async record(tx: Prisma.TransactionClient, entry: AuditEntry): Promise<void> {
    await tx.auditLog.create({
      data: {
        actor: entry.actor,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId,
        before: this.toJson(entry.before),
        after: this.toJson(entry.after),
      },
    });
  }

  private toJson(value: unknown): Prisma.InputJsonValue | typeof Prisma.DbNull {
    // DbNull -> real SQL NULL (e.g. no "before" on a CREATE), not a JSON null.
    return value === undefined || value === null
      ? Prisma.DbNull
      : (value as Prisma.InputJsonValue);
  }
}

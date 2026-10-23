import { Injectable } from '@nestjs/common';
import { ParticipantView } from '@org/contracts';
import { AuditEntry, AuditRepository } from '../../common/audit/audit.repository';
import { TransactionManager } from '../../database/transaction-manager';
import { ParticipantRepository } from './participant.repository';
import {
  CreateParticipantData,
  UpdateParticipantData,
} from './participant.type';

/**
 * The transaction-scoped operations a write use case can run. Deliberately
 * Prisma-free: the service composes these inside a transaction without ever
 * seeing a Prisma client or `$transaction`.
 */
export interface ParticipantTx {
  findById(id: string): Promise<ParticipantView | null>;
  create(data: CreateParticipantData): Promise<ParticipantView>;
  update(id: string, data: UpdateParticipantData): Promise<ParticipantView>;
  softDelete(id: string): Promise<void>;
  audit(entry: AuditEntry): Promise<void>;
}

/**
 * Participant unit of work. `run` opens one transaction (via the generic
 * TransactionManager) and hands the callback a {@link ParticipantTx} whose
 * operations - participant mutations and the audit write - all share that
 * transaction, so they commit or roll back together. The service owns the use
 * case (what runs inside the callback); the Prisma mechanics stay here and in
 * the repositories.
 */
@Injectable()
export class ParticipantUnitOfWork {
  constructor(
    private readonly transactions: TransactionManager,
    private readonly participants: ParticipantRepository,
    private readonly audit: AuditRepository,
  ) {}

  run<T>(work: (tx: ParticipantTx) => Promise<T>): Promise<T> {
    return this.transactions.run((client) =>
      work({
        findById: (id) => this.participants.findByIdTx(client, id),
        create: (data) => this.participants.createTx(client, data),
        update: (id, data) => this.participants.updateTx(client, id, data),
        softDelete: (id) => this.participants.softDeleteTx(client, id),
        audit: (entry) => this.audit.record(client, entry),
      }),
    );
  }
}

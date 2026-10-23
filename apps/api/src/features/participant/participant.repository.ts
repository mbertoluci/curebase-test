import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { classifyMeasurements, ParticipantView } from '@org/contracts';
import { PrismaService } from '../../database/prisma.service';
import {
  EmailAlreadyExistsError,
  ParticipantIntegrityError,
  ParticipantNotFoundError,
} from './participant.error';
import {
  CreateParticipantData,
  ParticipantFilter,
  ParticipantSort,
  Pagination,
  UpdateParticipantData,
} from './participant.type';

/** The join every read needs: a participant with its user's profile. */
const participantInclude = { user: { include: { profile: true } } } as const;
type ParticipantRow = Prisma.ParticipantGetPayload<{
  include: typeof participantInclude;
}>;

/** The single "active" (not soft-deleted) predicate, reused by every read/write. */
const ACTIVE = { deletedAt: null } as const;

/**
 * Prisma's known-request-error codes we translate. Prisma types `error.code` as a
 * plain string and ships no enum for these, so we name the two we handle here
 * instead of leaving the bare literals at the comparison site.
 * See https://www.prisma.io/docs/orm/reference/error-reference
 */
const PRISMA_ERROR = {
  RECORD_NOT_FOUND: 'P2025',
  UNIQUE_VIOLATION: 'P2002',
} as const;

/**
 * Data-access layer for participants. It is the ONLY place that knows the Prisma
 * schema: it builds queries, converts Decimal/Date entities into the plain
 * {@link ParticipantView} DTO, and translates database errors (unique violation)
 * into domain errors. Everything above it works in DTOs, never entities.
 *
 * Write methods take a transaction client so the service can compose them with
 * the audit write atomically.
 */
@Injectable()
export class ParticipantRepository {
  constructor(private readonly prisma: PrismaService) {}

  // Named accessor, mirroring the "this.<table>" style from the brief.
  private get participants() {
    return this.prisma.participant;
  }

  /** Non-transactional read for GET /:id. */
  async findById(id: string): Promise<ParticipantView | null> {
    const row = await this.participants.findFirst({
      where: { ...ACTIVE, id, user: ACTIVE },
      include: participantInclude,
    });
    return row ? this.toView(row) : null;
  }

  /** Transactional read used to build the "before" snapshot inside a write tx. */
  async findByIdTx(
    tx: Prisma.TransactionClient,
    id: string,
  ): Promise<ParticipantView | null> {
    const row = await tx.participant.findFirst({
      where: { ...ACTIVE, id, user: ACTIVE },
      include: participantInclude,
    });
    return row ? this.toView(row) : null;
  }

  /** Filtered, sorted, paginated list. Returns the page plus the total count. */
  async list(
    filter: ParticipantFilter,
    sort: ParticipantSort,
    page: Pagination,
  ): Promise<{ data: ParticipantView[]; total: number }> {
    const where = this.buildWhere(filter);
    const orderBy = this.buildOrderBy(sort);
    // Local read-only transaction, owned here because it has no mutation/audit.
    // Isolation follows the database default: under PostgreSQL READ COMMITTED,
    // rows and count can see different snapshots during concurrent writes.
    const [rows, total] = await this.prisma.$transaction([
      this.participants.findMany({
        where,
        orderBy,
        include: participantInclude,
        skip: (page.page - 1) * page.pageSize,
        take: page.pageSize,
      }),
      this.participants.count({ where }),
    ]);
    return { data: rows.map((row) => this.toView(row)), total };
  }

  /** Creates the user + profile + participant aggregate and returns the view. */
  async createTx(
    tx: Prisma.TransactionClient,
    data: CreateParticipantData,
  ): Promise<ParticipantView> {
    try {
      const user = await tx.user.create({
        data: {
          profile: {
            create: {
              firstName: data.firstName,
              lastName: data.lastName,
              email: data.email,
              phone: data.phone,
            },
          },
          participant: {
            create: {
              weight: data.weight,
              height: data.height,
              unit: data.unit,
              bmiValue: data.bmiValue,
              age: data.age,
            },
          },
        },
        select: { participant: { select: { id: true } } },
      });
      const id = user.participant?.id;
      if (!id) throw new Error('participant row was not created');
      return (await this.findByIdTx(tx, id)) as ParticipantView;
    } catch (error) {
      throw this.translateWriteError(error, data.email);
    }
  }

  /** Applies a partial update to profile (contact) and/or participant (measurements). */
  async updateTx(
    tx: Prisma.TransactionClient,
    id: string,
    data: UpdateParticipantData,
  ): Promise<ParticipantView> {
    const profileData = this.pickProfile(data);
    const participantData = this.pickParticipant(data);
    try {
      await tx.participant.update({
        where: { ...ACTIVE, id, user: ACTIVE },
        data: {
          ...participantData,
          ...(Object.keys(profileData).length > 0
            ? {
                user: {
                  update: {
                    where: ACTIVE,
                    data: {
                      profile: { update: { where: ACTIVE, data: profileData } },
                    },
                  },
                },
              }
            : {}),
        },
      });
    } catch (error) {
      throw this.translateWriteError(error, data.email ?? '', id);
    }
    const updated = await this.findByIdTx(tx, id);
    if (!updated) throw new ParticipantNotFoundError(id);
    return updated;
  }

  /** Soft-deletes the whole aggregate (participant + profile + user) in one tx. */
  async softDeleteTx(tx: Prisma.TransactionClient, id: string): Promise<void> {
    const row = await tx.participant.findFirst({
      where: { ...ACTIVE, id, user: ACTIVE },
      select: { userId: true },
    });
    if (!row) return; // caller already verified existence; nothing to do
    const deletedAt = new Date();
    await tx.participant.update({
      where: { ...ACTIVE, id, user: ACTIVE },
      data: { deletedAt },
    });
    await tx.profile.update({
      where: { ...ACTIVE, userId: row.userId },
      data: { deletedAt },
    });
    await tx.user.update({
      where: { ...ACTIVE, id: row.userId },
      data: { deletedAt },
    });
  }

  // --- mapping & query building (private) --------------------------------

  /** The single entity -> DTO boundary: Decimal -> number, Date -> ISO, derive band. */
  private toView(row: ParticipantRow): ParticipantView {
    const profile = row.user.profile;
    // An active participant must have an active profile (createTx and
    // softDeleteTx always move them together). A missing one is a data-integrity
    // violation, not an empty-string participant - fail loudly (500) rather than
    // fabricate blank PII.
    if (!profile || profile.deletedAt !== null) {
      throw new ParticipantIntegrityError(row.id);
    }
    const weight = row.weight.toNumber();
    const height = row.height.toNumber();
    return {
      id: row.id,
      firstName: profile.firstName,
      lastName: profile.lastName,
      email: profile.email,
      phone: profile.phone ?? null,
      weight,
      height,
      unit: row.unit,
      age: row.age,
      bmiValue: row.bmiValue.toNumber(),
      // Classify on the unrounded BMI from the measurements, not the stored
      // 2-decimal bmiValue - otherwise a boundary rounding (e.g. 24.997 -> 25.00)
      // would flip the band. bmiValue stays the display/filter number.
      bmiBand: classifyMeasurements(weight, height, row.unit, row.age),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private buildWhere(filter: ParticipantFilter): Prisma.ParticipantWhereInput {
    const where: Prisma.ParticipantWhereInput = { ...ACTIVE, user: ACTIVE };

    if (filter.unit) where.unit = filter.unit;

    if (filter.minBmi !== undefined || filter.maxBmi !== undefined) {
      where.bmiValue = { gte: filter.minBmi, lte: filter.maxBmi };
    }
    if (filter.minAge !== undefined || filter.maxAge !== undefined) {
      where.age = { gte: filter.minAge, lte: filter.maxAge };
    }
    if (filter.search) {
      const contains = {
        contains: filter.search,
        mode: 'insensitive' as const,
      };
      where.user = {
        ...ACTIVE,
        profile: {
          OR: [
            { firstName: contains },
            { lastName: contains },
            { email: contains },
          ],
        },
      };
    }
    return where;
  }

  private buildOrderBy(
    sort: ParticipantSort,
  ): Prisma.ParticipantOrderByWithRelationInput[] {
    const primary: Prisma.ParticipantOrderByWithRelationInput =
      sort.field === 'lastName'
        ? { user: { profile: { lastName: sort.direction } } }
        : ({
            [sort.field]: sort.direction,
          } as Prisma.ParticipantOrderByWithRelationInput);
    // Tie-break on the primary key so pagination is stable when the sort key
    // repeats (e.g. many rows with the same age) - otherwise a row can skip or
    // repeat across pages.
    return [primary, { id: 'asc' }];
  }

  private pickProfile(data: UpdateParticipantData): Prisma.ProfileUpdateInput {
    const out: Prisma.ProfileUpdateInput = {};
    if (data.firstName !== undefined) out.firstName = data.firstName;
    if (data.lastName !== undefined) out.lastName = data.lastName;
    if (data.email !== undefined) out.email = data.email;
    if (data.phone !== undefined) out.phone = data.phone;
    return out;
  }

  private pickParticipant(
    data: UpdateParticipantData,
  ): Prisma.ParticipantUpdateInput {
    const out: Prisma.ParticipantUpdateInput = {};
    if (data.weight !== undefined) out.weight = data.weight;
    if (data.height !== undefined) out.height = data.height;
    if (data.unit !== undefined) out.unit = data.unit;
    if (data.age !== undefined) out.age = data.age;
    if (data.bmiValue !== undefined) out.bmiValue = data.bmiValue;
    return out;
  }

  /** Map Prisma's unique-violation (the partial email index) to a domain error. */
  private translateWriteError(
    error: unknown,
    email: string,
    id?: string,
  ): unknown {
    if (
      id &&
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === PRISMA_ERROR.RECORD_NOT_FOUND
    ) {
      return new ParticipantNotFoundError(id);
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === PRISMA_ERROR.UNIQUE_VIOLATION
    ) {
      return new EmailAlreadyExistsError(email);
    }
    return error;
  }
}

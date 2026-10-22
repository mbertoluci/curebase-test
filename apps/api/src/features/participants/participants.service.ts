import { Injectable } from '@nestjs/common';
import {
  computeBmi,
  CreateParticipantInput,
  DEFAULT_PAGE_SIZE,
  ListParticipantsQuery,
  measurementErrors,
  MAX_PAGE_SIZE,
  Paginated,
  ParticipantView,
  roundBmi,
  UpdateParticipantInput,
} from '@org/contracts';
import { AuditService } from '../../common/audit/audit.service';
import { InputValidationError } from '../../common/errors/validation.error';
import { PrismaService } from '../../database/prisma.service';
import { ParticipantNotFoundError } from './participants.error';
import { ParticipantsRepository } from './participants.repository';
import {
  CreateParticipantData,
  ParticipantFilter,
  ParticipantSort,
  UpdateParticipantData,
} from './participants.type';

/**
 * Application/domain layer. Owns:
 *  - the BMI derivation (compute-and-store, recomputed on every change);
 *  - the per-unit plausibility business rule;
 *  - the transaction boundary, so each mutation and its audit row commit together.
 * It speaks DTOs in and out; the repository handles persistence.
 */
@Injectable()
export class ParticipantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repository: ParticipantsRepository,
    private readonly audit: AuditService,
  ) {}

  async create(
    input: CreateParticipantInput,
    actor: string,
  ): Promise<ParticipantView> {
    const bmiValue = this.deriveBmi(
      input.weight,
      input.height,
      input.unit,
      input.age,
    );
    const data: CreateParticipantData = {
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      phone: input.phone ?? null,
      weight: input.weight,
      height: input.height,
      unit: input.unit,
      age: input.age,
      bmiValue,
    };

    return this.prisma.$transaction(async (tx) => {
      const created = await this.repository.createTx(tx, data);
      await this.audit.record(tx, {
        actor,
        action: 'CREATE',
        entity: 'participant',
        entityId: created.id,
        after: created,
      });
      return created;
    });
  }

  async update(
    id: string,
    patch: UpdateParticipantInput,
    actor: string,
  ): Promise<ParticipantView> {
    return this.prisma.$transaction(async (tx) => {
      const before = await this.repository.findByIdTx(tx, id);
      if (!before) throw new ParticipantNotFoundError(id);

      const data: UpdateParticipantData = { ...this.pickContact(patch) };

      // Recompute BMI only if a measurement input changed, using the merged set.
      const measurementTouched =
        patch.weight !== undefined ||
        patch.height !== undefined ||
        patch.unit !== undefined ||
        patch.age !== undefined;

      if (measurementTouched) {
        const weight = patch.weight ?? before.weight;
        const height = patch.height ?? before.height;
        const unit = patch.unit ?? before.unit;
        const age = patch.age ?? before.age;
        const bmiValue = this.deriveBmi(weight, height, unit, age);
        Object.assign(data, { weight, height, unit, age, bmiValue });
      }

      const after = await this.repository.updateTx(tx, id, data);
      await this.audit.record(tx, {
        actor,
        action: 'UPDATE',
        entity: 'participant',
        entityId: id,
        before,
        after,
      });
      return after;
    });
  }

  async findById(id: string): Promise<ParticipantView> {
    const view = await this.repository.findById(id);
    if (!view) throw new ParticipantNotFoundError(id);
    return view;
  }

  async list(
    query: ListParticipantsQuery,
  ): Promise<Paginated<ParticipantView>> {
    const page = query.page && query.page > 0 ? query.page : 1;
    const pageSize = Math.min(
      query.pageSize ?? DEFAULT_PAGE_SIZE,
      MAX_PAGE_SIZE,
    );

    const filter: ParticipantFilter = {
      search: query.search,
      unit: query.unit,
      minBmi: query.minBmi,
      maxBmi: query.maxBmi,
      minAge: query.minAge,
      maxAge: query.maxAge,
    };
    const sort: ParticipantSort = {
      field: query.sortBy ?? 'createdAt',
      direction: query.sortDir ?? 'desc',
    };

    const { data, total } = await this.repository.list(filter, sort, {
      page,
      pageSize,
    });
    return {
      data,
      pageInfo: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    };
  }

  async remove(id: string, actor: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const before = await this.repository.findByIdTx(tx, id);
      if (!before) throw new ParticipantNotFoundError(id);
      await this.repository.softDeleteTx(tx, id);
      await this.audit.record(tx, {
        actor,
        action: 'DELETE',
        entity: 'participant',
        entityId: id,
        before,
      });
    });
  }

  // --- helpers -----------------------------------------------------------

  /** Validate the per-unit business rule, then compute + round the BMI. */
  private deriveBmi(
    weight: number,
    height: number,
    unit: CreateParticipantInput['unit'],
    age: number,
  ): number {
    const errors = measurementErrors(weight, height, unit, age);
    if (errors.length > 0) throw new InputValidationError(errors);
    return roundBmi(computeBmi(weight, height, unit), 2);
  }

  private pickContact(patch: UpdateParticipantInput): UpdateParticipantData {
    const data: UpdateParticipantData = {};
    if (patch.firstName !== undefined) data.firstName = patch.firstName;
    if (patch.lastName !== undefined) data.lastName = patch.lastName;
    if (patch.email !== undefined) data.email = patch.email;
    if (patch.phone !== undefined) data.phone = patch.phone ?? null;
    return data;
  }
}

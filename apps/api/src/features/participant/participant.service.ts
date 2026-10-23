import { Injectable } from '@nestjs/common';
import {
  computeBmi,
  CreateParticipantInput,
  DEFAULT_PAGE_SIZE,
  DEFAULT_SORT_DIR,
  DEFAULT_SORT_FIELD,
  ListParticipantQuery,
  measurementErrors,
  MAX_PAGE_SIZE,
  Paginated,
  ParticipantView,
  roundBmi,
  UpdateParticipantInput,
} from '@org/contracts';
import { AuditAction, AuditEntity } from '../../common/audit/audit.repository';
import { InputValidationError } from '../../common/errors/validation.error';
import { ParticipantNotFoundError } from './participant.error';
import { ParticipantRepository } from './participant.repository';
import { ParticipantUnitOfWork } from './participant.unit-of-work';
import {
  CreateParticipantData,
  ParticipantFilter,
  ParticipantSort,
  UpdateParticipantData,
  UpdateParticipantInputData,
} from './participant.type';

/**
 * Application/domain layer. Owns:
 *  - the BMI derivation (compute-and-store, recomputed on every change);
 *  - the per-unit plausibility business rule;
 *  - the use case run inside the unit of work (which owns the transaction).
 * It speaks DTOs in and out and never touches Prisma: reads go through the
 * repository, writes through the unit of work.
 */
@Injectable()
export class ParticipantService {
  constructor(
    private readonly repository: ParticipantRepository,
    private readonly uow: ParticipantUnitOfWork,
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

    return this.uow.run(async (tx) => {
      const created = await tx.create(data);
      await tx.audit({
        actor,
        action: AuditAction.CREATE,
        entity: AuditEntity.PARTICIPANT,
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
    return this.uow.run(async (tx) => {
      const before = await tx.findById(id);
      if (!before) throw new ParticipantNotFoundError(id);

      // Changing the unit reinterprets weight+height, so the old stored values
      // (in the old unit) can't be reused: both must be supplied in the new unit.
      if (
        patch.unit !== undefined &&
        patch.unit !== before.unit &&
        (patch.weight === undefined || patch.height === undefined)
      ) {
        throw new InputValidationError([
          'weight and height are required when changing the unit',
        ]);
      }

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

      const after = await tx.update(id, data);
      await tx.audit({
        actor,
        action: AuditAction.UPDATE,
        entity: AuditEntity.PARTICIPANT,
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

  async list(query: ListParticipantQuery): Promise<Paginated<ParticipantView>> {
    const page = query.page && query.page > 0 ? query.page : 1;
    const pageSize = Math.min(
      query.pageSize ?? DEFAULT_PAGE_SIZE,
      MAX_PAGE_SIZE,
    );

    this.assertRangeOrder(query);

    const filter: ParticipantFilter = {
      search: query.search,
      unit: query.unit,
      minBmi: query.minBmi,
      maxBmi: query.maxBmi,
      minAge: query.minAge,
      maxAge: query.maxAge,
    };
    const sort: ParticipantSort = {
      field: query.sortBy ?? DEFAULT_SORT_FIELD,
      direction: query.sortDir ?? DEFAULT_SORT_DIR,
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
    await this.uow.run(async (tx) => {
      const before = await tx.findById(id);
      if (!before) throw new ParticipantNotFoundError(id);
      await tx.softDelete(id);
      await tx.audit({
        actor,
        action: AuditAction.DELETE,
        entity: AuditEntity.PARTICIPANT,
        entityId: id,
        before,
      });
    });
  }

  // --- helpers -----------------------------------------------------------

  /** Reject inverted filter ranges (min greater than max) with a 400, not silence. */
  private assertRangeOrder(query: ListParticipantQuery): void {
    const errors: string[] = [];
    if (
      query.minBmi !== undefined &&
      query.maxBmi !== undefined &&
      query.minBmi > query.maxBmi
    ) {
      errors.push('minBmi must not be greater than maxBmi');
    }
    if (
      query.minAge !== undefined &&
      query.maxAge !== undefined &&
      query.minAge > query.maxAge
    ) {
      errors.push('minAge must not be greater than maxAge');
    }
    if (errors.length > 0) throw new InputValidationError(errors);
  }

  /** Validate the per-unit business rule, then compute + round the BMI. */
  private deriveBmi(
    weight: number,
    height: number,
    unit: CreateParticipantInput['unit'],
    age: number,
  ): number {
    const errors = measurementErrors(weight, height, unit, age);
    if (errors.length > 0) {
      throw new InputValidationError(errors.map((e) => e.message));
    }
    return roundBmi(computeBmi(weight, height, unit), 2);
  }

  private pickContact(
    patch: UpdateParticipantInput,
  ): UpdateParticipantInputData {
    const data: UpdateParticipantInputData = {};
    if (patch.firstName !== undefined) data.firstName = patch.firstName;
    if (patch.lastName !== undefined) data.lastName = patch.lastName;
    if (patch.email !== undefined) data.email = patch.email;
    if (patch.phone !== undefined) data.phone = patch.phone ?? null;
    return data;
  }
}

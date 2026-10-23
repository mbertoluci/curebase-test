import { ParticipantSortField, SortDirection, Unit } from '@org/contracts';

/**
 * Repository-facing types. These describe exactly what the data-access layer
 * accepts and the shapes it works with internally - deliberately separate from
 * the HTTP DTOs (apps/.../participant.dto.ts) and from the Prisma entities.
 */

/** Everything needed to persist a new participant aggregate (profile + measurements + derived BMI). */
export interface CreateParticipantData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  weight: number;
  height: number;
  unit: Unit;
  age: number;
  /** Derived server-side by the service; the repository only stores it. */
  bmiValue: number;
}

/** Fields a caller may change on update - never the derived BMI (G08/B5). */
export type UpdateParticipantInputData = Partial<
  Omit<CreateParticipantData, 'bmiValue'>
>;

/**
 * What the repository persists on update: the caller's input fields plus, only
 * when a measurement changed, the BMI the service derives. bmiValue can only be
 * set here by the service, not by anything mapping external input.
 */
export type UpdateParticipantData = UpdateParticipantInputData & {
  bmiValue?: number;
};

/** Allow-listed filters for the list query (translated from the HTTP query DTO). */
export interface ParticipantFilter {
  search?: string;
  unit?: Unit;
  minBmi?: number;
  maxBmi?: number;
  minAge?: number;
  maxAge?: number;
}

export interface ParticipantSort {
  field: ParticipantSortField;
  direction: SortDirection;
}

export interface Pagination {
  page: number;
  pageSize: number;
}

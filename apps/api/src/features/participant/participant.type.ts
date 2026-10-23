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

/** Partial patch for an update; only the provided fields change. */
export type UpdateParticipantData = Partial<CreateParticipantData>;

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

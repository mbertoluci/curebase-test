/**
 * Transport shapes shared between the API and the web client.
 *
 * These are plain structural types (the wire contract). The API declares its own
 * class-validator DTO classes that structurally satisfy these; the web imports
 * them to type requests and responses. Keeping one contract stops the two apps
 * from drifting apart.
 */
import type { BmiBand } from './bmi';
import type { Unit } from './units';

/** Identity / PII fields (the `profiles` row). */
export interface ProfileInput {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
}

/** Health measurement fields (the `participants` row). */
export interface MeasurementInput {
  weight: number;
  height: number;
  unit: Unit;
  age: number;
}

/** Body of POST /participants (single form submit creates user+profile+participant). */
export type CreateParticipantInput = ProfileInput & MeasurementInput;

/** Body of PUT /participants/:id - any subset of the create fields. */
export type UpdateParticipantInput = Partial<CreateParticipantInput>;

/** A participant as returned to clients (joined, with the derived BMI + band). */
export interface ParticipantView {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  weight: number;
  height: number;
  unit: Unit;
  age: number;
  bmiValue: number;
  bmiBand: BmiBand | null;
  createdAt: string;
  updatedAt: string;
}

export type ParticipantSortField =
  'createdAt' | 'bmiValue' | 'age' | 'lastName';
export type SortDirection = 'asc' | 'desc';

/** The one default sort, shared so the API and the web client cannot drift. */
export const DEFAULT_SORT_FIELD: ParticipantSortField = 'createdAt';
export const DEFAULT_SORT_DIR: SortDirection = 'desc';

/** Exhaustive sets: missing or unknown keys fail compilation against the unions. */
const PARTICIPANT_SORT_FIELD_SET = {
  createdAt: true,
  bmiValue: true,
  age: true,
  lastName: true,
} as const satisfies Record<ParticipantSortField, true>;
const SORT_DIRECTION_SET = {
  asc: true,
  desc: true,
} as const satisfies Record<SortDirection, true>;

/** Runtime allow-lists are derived from the exhaustive sets, preserving order. */
export const PARTICIPANT_SORT_FIELDS: readonly ParticipantSortField[] =
  Object.keys(PARTICIPANT_SORT_FIELD_SET) as ParticipantSortField[];
export const SORT_DIRECTIONS: readonly SortDirection[] =
  Object.keys(SORT_DIRECTION_SET) as SortDirection[];

/**
 * Canonical email form. Email is treated case-insensitively (and trimmed), so
 * the API stores and de-duplicates on this form and the web compares with it;
 * "A@X.com" and "a@x.com" are the same participant.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Allow-listed query contract for GET /participants (filter + sort + paginate). */
export interface ListParticipantsQuery {
  page?: number;
  pageSize?: number;
  /** Free-text match on first/last name or email. */
  search?: string;
  unit?: Unit;
  minBmi?: number;
  maxBmi?: number;
  minAge?: number;
  maxAge?: number;
  sortBy?: ParticipantSortField;
  sortDir?: SortDirection;
}

export interface PageInfo {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface Paginated<T> {
  data: T[];
  pageInfo: PageInfo;
}

export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

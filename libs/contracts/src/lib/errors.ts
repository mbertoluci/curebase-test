/**
 * Stable, machine-readable error contract shared with the web client.
 *
 * Clients branch on `code` (never on the human `message`), so these strings are
 * part of the API contract and must stay stable across refactors.
 */
export enum ErrorCode {
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  PARTICIPANT_NOT_FOUND = 'PARTICIPANT_NOT_FOUND',
  EMAIL_ALREADY_EXISTS = 'EMAIL_ALREADY_EXISTS',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

/** The single error envelope every failed request returns. */
export interface ApiErrorBody {
  statusCode: number;
  code: ErrorCode | string;
  message: string;
  /** Optional structured detail, e.g. per-field validation messages. */
  details?: unknown;
  timestamp: string;
  path?: string;
}

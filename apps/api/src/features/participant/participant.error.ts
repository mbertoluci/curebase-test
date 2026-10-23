import { HttpStatus } from '@nestjs/common';
import { ErrorCode } from '@org/contracts';
import { AppException } from '../../common/errors/app-exception';

/** The requested participant does not exist (or was soft-deleted). */
export class ParticipantNotFoundError extends AppException {
  static readonly httpStatus = HttpStatus.NOT_FOUND;
  static readonly code = ErrorCode.PARTICIPANT_NOT_FOUND;

  constructor(id: string) {
    super(
      ParticipantNotFoundError.code,
      ParticipantNotFoundError.httpStatus,
      `Participant "${id}" was not found`,
    );
  }
}

/**
 * An active participant has no active profile - a data-integrity violation that
 * should never happen (create and soft-delete move them together). It is a 500
 * (internal), flattened to a generic message by the global filter; the detail
 * is logged server-side, never fabricated into a blank-PII participant.
 */
export class ParticipantIntegrityError extends AppException {
  static readonly httpStatus = HttpStatus.INTERNAL_SERVER_ERROR;
  static readonly code = ErrorCode.INTERNAL_ERROR;

  constructor(id: string) {
    super(
      ParticipantIntegrityError.code,
      ParticipantIntegrityError.httpStatus,
      `Participant "${id}" has no active profile (data integrity)`,
    );
  }
}

/** An active participant already uses this email (partial unique index hit). */
export class EmailAlreadyExistsError extends AppException {
  static readonly httpStatus = HttpStatus.CONFLICT;
  static readonly code = ErrorCode.EMAIL_ALREADY_EXISTS;

  constructor(email: string) {
    super(
      EmailAlreadyExistsError.code,
      EmailAlreadyExistsError.httpStatus,
      `A participant with email "${email}" already exists`,
      { email },
    );
  }
}

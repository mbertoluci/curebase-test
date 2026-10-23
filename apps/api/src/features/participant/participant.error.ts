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

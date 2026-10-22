import { HttpStatus } from '@nestjs/common';
import { ErrorCode } from '@org/contracts';
import { AppException } from './app-exception';

/**
 * Raised for *domain* validation failures that the DTO layer can't express
 * (e.g. per-unit plausibility bounds, which are a cross-field business rule).
 * Structural/type validation is handled earlier by the global ValidationPipe.
 */
export class InputValidationError extends AppException {
  static readonly httpStatus = HttpStatus.BAD_REQUEST;
  static readonly code = ErrorCode.VALIDATION_FAILED;

  constructor(messages: string[]) {
    super(
      InputValidationError.code,
      InputValidationError.httpStatus,
      'Validation failed',
      messages,
    );
  }
}

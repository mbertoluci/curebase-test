import { HttpStatus } from '@nestjs/common';
import { ErrorCode } from '@org/contracts';

/**
 * Base class for every *expected* domain error.
 *
 * Carrying a stable machine `code` (not just an HTTP status) means clients and
 * the web app branch on the code, and the global exception filter can turn any
 * AppException into the one error envelope without leaking internals. Concrete
 * errors live next to their feature (e.g. participant.error.ts) and expose
 * static `httpStatus`/`code` so the `@Throws()` decorator can document them.
 */
export abstract class AppException extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly httpStatus: HttpStatus,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

/** Shape of an AppException subclass, including the static metadata. */
export interface AppExceptionClass {
  new (...args: never[]): AppException;
  readonly httpStatus: HttpStatus;
  readonly code: ErrorCode;
}

import { applyDecorators } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';
import { AppExceptionClass } from './app-exception';

/**
 * Declares the expected domain errors a controller method can raise.
 *
 * It is documentation that cannot drift: the same list that tells a reader what
 * can go wrong also generates the OpenAPI error responses (via `@ApiResponse`),
 * reading each error class's static `httpStatus`/`code`. The actual throwing is
 * still done by the service; this only declares the contract.
 */
export function Throws(
  ...errors: AppExceptionClass[]
): MethodDecorator & ClassDecorator {
  return applyDecorators(
    ...errors.map((error) =>
      ApiResponse({ status: error.httpStatus, description: error.code }),
    ),
  );
}

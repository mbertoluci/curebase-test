import { applyDecorators } from '@nestjs/common';
import { ApiBadRequestResponse } from '@nestjs/swagger';
import { VALIDATION_ERROR_DESCRIPTION } from '../api.constants';

/**
 * Declares the structural 400 (VALIDATION_FAILED) in OpenAPI. One decorator
 * instead of repeating the same @ApiBadRequestResponse literal on every route
 * that validates input.
 */
export function ApiValidationErrorResponse(): MethodDecorator & ClassDecorator {
  return applyDecorators(
    ApiBadRequestResponse({ description: VALIDATION_ERROR_DESCRIPTION }),
  );
}

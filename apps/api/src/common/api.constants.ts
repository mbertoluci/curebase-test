/**
 * Centralized HTTP surface constants, so routes, OpenAPI tags and shared
 * response descriptions are declared once instead of as string literals
 * scattered across the controllers.
 */
export const API_ROUTES = {
  participants: 'participants',
  health: 'health',
} as const;

export const API_TAGS = {
  participants: 'participants',
  health: 'health',
} as const;

/** Description used by the shared validation-error OpenAPI decorator. */
export const VALIDATION_ERROR_DESCRIPTION = 'Validation failed (VALIDATION_FAILED)';

/** Header the actor is read from (no auth in scope) and its anonymous default. */
export const ACTOR_HEADER = 'x-actor-id';
export const DEFAULT_ACTOR = 'anonymous';

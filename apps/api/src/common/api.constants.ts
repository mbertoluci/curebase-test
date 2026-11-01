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
export const VALIDATION_ERROR_DESCRIPTION =
  'Validation failed (VALIDATION_FAILED)';

/** Header the actor is read from (no auth in scope) and its anonymous default. */
export const ACTOR_HEADER = 'x-actor-id';
export const DEFAULT_ACTOR = 'anonymous';

/**
 * The actor header is free text (no auth), but it is persisted verbatim on every
 * audit row, so it still needs a boundary. Cap the length and restrict to a safe
 * printable charset - enough for a UUID session id, an email or a username, but
 * not an unbounded blob or control characters that could poison the audit log.
 */
export const ACTOR_MAX_LENGTH = 128;
export const ACTOR_PATTERN = /^[\w.@:+-]+$/;

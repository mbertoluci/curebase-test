import { ErrorCode } from '@org/contracts';
import { ApiError } from './http';
import { reportError } from './report-error';

/**
 * A failed request, normalized into a shape the UI can render directly: the
 * messages that belong to a specific input are split out by field, and
 * everything else collapses into one form-level message. Callers keep the
 * machine `code` so a feature can still add its own affordance for a case it
 * cares about (e.g. offering to edit an existing record on a duplicate email).
 */
export interface NormalizedError<Field extends string = string> {
  /** Per-field messages, keyed by the server's field name. */
  fieldErrors: Partial<Record<Field, string>>;
  /** A single message for everything not tied to a field: network/server
   * failures, a missing record, or validation messages for unknown fields. */
  formError?: string;
  /** The machine error code, stable across refactors - branch on this, never
   * on the human message. */
  code: string;
  /** HTTP status (0 for a transport/network failure). */
  status: number;
}

const GENERIC_MESSAGE = 'Something went wrong. Please try again.';

/**
 * Turn any thrown value from an API call into a {@link NormalizedError}.
 *
 * `fields` is the allow-list of server field names this caller renders: a
 * validation message is routed to a field only when its leading token matches
 * one of them, so an unknown field (or a non-field domain message) safely falls
 * to the form-level error instead of attaching to a control that isn't there.
 * Anything that is not an {@link ApiError} is a bug: it is reported through the
 * single error sink and surfaces as the generic message (never a raw stack).
 */
export function normalizeApiError<Field extends string>(
  error: unknown,
  fields: readonly Field[],
  context: string,
): NormalizedError<Field> {
  if (!(error instanceof ApiError)) {
    reportError(error, context);
    return {
      fieldErrors: {},
      formError: GENERIC_MESSAGE,
      code: 'UNKNOWN',
      status: 0,
    };
  }

  const fieldErrors: Partial<Record<Field, string>> = {};
  const formMessages: string[] = [];

  switch (error.code) {
    case ErrorCode.EMAIL_ALREADY_EXISTS: {
      const field = matchField('email', fields);
      if (field)
        fieldErrors[field] = 'A participant with this email already exists';
      else formMessages.push(error.message);
      break;
    }
    case ErrorCode.VALIDATION_FAILED: {
      const details = Array.isArray(error.details)
        ? (error.details as unknown[])
        : [];
      if (details.length === 0) {
        formMessages.push(error.message);
        break;
      }
      for (const detail of details) {
        if (typeof detail !== 'string') continue;
        const field = matchField(leadingToken(detail), fields);
        // ??= so the first message for a field wins (class-validator can emit
        // several per field; the first is the most specific for the UI).
        if (field) fieldErrors[field] ??= humanize(detail, field);
        else formMessages.push(detail);
      }
      break;
    }
    case ErrorCode.PARTICIPANT_NOT_FOUND:
      formMessages.push(
        'This record no longer exists - it may have been removed.',
      );
      break;
    default:
      // NETWORK_ERROR / INTERNAL_ERROR / INVALID_RESPONSE / HTTP_* / UNKNOWN:
      // the http layer and the server filter already supply a safe message.
      formMessages.push(error.message || GENERIC_MESSAGE);
  }

  return {
    fieldErrors,
    formError: formMessages.length ? formMessages.join(' · ') : undefined,
    code: error.code,
    status: error.status,
  };
}

/** The first whitespace-delimited token of a message (class-validator and our
 * domain messages both lead with the offending property name). */
function leadingToken(message: string): string {
  return message.trim().split(/\s+/, 1)[0] ?? '';
}

/** Resolve a token to one of the caller's fields, case-insensitively (domain
 * messages may capitalize the field, e.g. "Weight ..."). */
function matchField<Field extends string>(
  token: string,
  fields: readonly Field[],
): Field | undefined {
  const lower = token.toLowerCase();
  return fields.find((f) => f.toLowerCase() === lower);
}

/** Drop the leading field token and sentence-case the rest, so the message
 * reads naturally under its own label ("weight must be positive" -> "Must be
 * positive"). Falls back to the original message if nothing is left. */
function humanize(message: string, field: string): string {
  const rest = message
    .trim()
    .slice(field.length)
    .replace(/^[\s:.-]+/, '')
    .trim();
  if (!rest) return message;
  return rest.charAt(0).toUpperCase() + rest.slice(1);
}

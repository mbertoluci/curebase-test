/**
 * The single client-side error sink. Unexpected failures are routed here so they
 * leave a trail (today a structured console.error) instead of being swallowed.
 * Swap the body for a real transport (Sentry/OTel) without touching call sites.
 */
export function reportError(error: unknown, context: string): void {
  // Log only safe fields: never the whole error object, whose arbitrary
  // properties (e.g. an ApiError's `details`) could carry server-echoed data.
  const detail =
    error instanceof Error
      ? { name: error.name, message: error.message, stack: error.stack }
      : { value: String(error) };
  console.error(`[${context}]`, detail);
}

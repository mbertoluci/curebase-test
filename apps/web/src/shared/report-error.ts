/**
 * The single client-side error sink. Unexpected failures are routed here so they
 * leave a trail (today a structured console.error) instead of being swallowed.
 * Swap the body for a real transport (Sentry/OTel) without touching call sites.
 */
export function reportError(error: unknown, context: string): void {
  const name = error instanceof Error ? error.name : 'UnknownError';

  if (process.env.NODE_ENV === 'production') {
    // No sanitizing transport is wired yet, so in production record only the
    // error class and context - never a message or stack, which could embed PII
    // in the end user's console. Replace this branch with that transport.
    console.error(`[${context}] ${name}`);
    return;
  }

  // Development: full detail for debugging, but never the whole error object
  // (its arbitrary fields, e.g. an ApiError's `details`, could carry PII).
  console.error(`[${context}]`, {
    name,
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });
}

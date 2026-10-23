/**
 * The single client-side error sink. Unexpected failures are routed here so they
 * leave a trail (today a structured console.error) instead of being swallowed.
 * Swap the body for a real transport (Sentry/OTel) without touching call sites.
 */
export function reportError(error: unknown, context: string): void {
  console.error(`[${context}]`, error);
}

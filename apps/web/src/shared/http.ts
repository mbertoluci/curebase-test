import type { ApiErrorBody } from '@org/contracts';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333/api';

/** Error carrying the API's machine code, so the UI can branch on it. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * The single fetch wrapper: prefixes the base URL, parses JSON, and turns every
 * failure (network, non-2xx, unreadable body) into a typed {@link ApiError}.
 * Feature API modules build their endpoints on top of this.
 */
export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  // Normalize the caller's headers (plain object, array or Headers) and add a
  // JSON Content-Type only when we actually send a body - a Content-Type on a
  // bodyless GET would force a CORS preflight when the API is cross-origin.
  const headers = new Headers(init?.headers);
  if (init?.body && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, { ...init, headers });
  } catch {
    throw new ApiError(
      0,
      'NETWORK_ERROR',
      'Could not reach the server. Please try again.',
    );
  }

  if (res.status === 204) return undefined as T;

  const body = (await res.json().catch(() => null)) as unknown;
  if (!res.ok) {
    const err = body as ApiErrorBody | null;
    throw new ApiError(
      res.status,
      err?.code ?? 'UNKNOWN',
      err?.message ?? 'Request failed',
      err?.details,
    );
  }
  // A 2xx that should carry JSON but didn't (unreadable body, or an HTML page
  // from a proxy) must not be handed back as a bogus T - fail with a clear code.
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new ApiError(
      res.status,
      'INVALID_RESPONSE',
      'The API returned a response that could not be read.',
    );
  }
  return body as T;
}

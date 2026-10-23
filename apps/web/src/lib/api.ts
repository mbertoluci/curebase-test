import type {
  ApiErrorBody,
  CreateParticipantInput,
  ListParticipantsQuery,
  Paginated,
  ParticipantView,
  UpdateParticipantInput,
} from '@org/contracts';

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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      headers: { 'content-type': 'application/json' },
      ...init,
    });
  } catch {
    throw new ApiError(
      0,
      'NETWORK_ERROR',
      'Could not reach the API. Is it running?',
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

function toQueryString(query: ListParticipantsQuery): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') {
      params.set(key, String(value));
    }
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export const api = {
  list: (
    query: ListParticipantsQuery = {},
  ): Promise<Paginated<ParticipantView>> =>
    request(`/participants${toQueryString(query)}`),
  get: (id: string): Promise<ParticipantView> => request(`/participants/${id}`),
  create: (input: CreateParticipantInput): Promise<ParticipantView> =>
    request('/participants', { method: 'POST', body: JSON.stringify(input) }),
  update: (
    id: string,
    patch: UpdateParticipantInput,
  ): Promise<ParticipantView> =>
    request(`/participants/${id}`, {
      method: 'PUT',
      body: JSON.stringify(patch),
    }),
  remove: (id: string): Promise<void> =>
    request(`/participants/${id}`, { method: 'DELETE' }),
};

import type {
  CreateParticipantInput,
  ListParticipantQuery,
  Paginated,
  ParticipantView,
  UpdateParticipantInput,
} from '@org/contracts';
import { ApiError, request } from '../../shared/http';

function toQueryString(query: ListParticipantQuery): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') {
      params.set(key, String(value));
    }
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

const invalid = (what: string): never => {
  throw new ApiError(
    200,
    'INVALID_RESPONSE',
    `The API returned ${what} that could not be read.`,
  );
};

/** A 2xx body that parsed as JSON is still untrusted: verify the shape the UI
 * consumes before handing it to React, so a malformed payload surfaces as a
 * clear error instead of crashing a render on a missing field. */
function asView(body: unknown): ParticipantView {
  const v = body as Partial<ParticipantView> | null;
  if (
    !v ||
    typeof v.id !== 'string' ||
    typeof v.email !== 'string' ||
    typeof v.bmiValue !== 'number'
  ) {
    invalid('a participant');
  }
  return body as ParticipantView;
}

function asPage(body: unknown): Paginated<ParticipantView> {
  const p = body as {
    data?: unknown;
    pageInfo?: Record<string, unknown>;
  } | null;
  if (
    !p ||
    !Array.isArray(p.data) ||
    !p.pageInfo ||
    typeof p.pageInfo.page !== 'number' ||
    typeof p.pageInfo.total !== 'number' ||
    typeof p.pageInfo.totalPages !== 'number'
  ) {
    invalid('a participant list');
  }
  return body as Paginated<ParticipantView>;
}

const ACTOR_HEADER = 'x-actor-id';
const ACTOR_STORAGE_KEY = 'bmi.actorId';

/**
 * An ephemeral per-session identifier sent as the audit actor on mutations.
 * Without authentication this is not a real identity, but it lets the audit log
 * group a session's changes instead of recording every mutation as 'anonymous'.
 */
function actorHeaders(): Record<string, string> {
  try {
    let id = sessionStorage.getItem(ACTOR_STORAGE_KEY);
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem(ACTOR_STORAGE_KEY, id);
    }
    return { [ACTOR_HEADER]: id };
  } catch {
    return {};
  }
}

/** Participant endpoints, built on the shared {@link request} wrapper. */
export const api = {
  list: (
    query: ListParticipantQuery = {},
    signal?: AbortSignal,
  ): Promise<Paginated<ParticipantView>> =>
    request(`/participants${toQueryString(query)}`, { signal }).then(asPage),
  get: (id: string): Promise<ParticipantView> =>
    request(`/participants/${id}`).then(asView),
  create: (input: CreateParticipantInput): Promise<ParticipantView> =>
    request('/participants', {
      method: 'POST',
      body: JSON.stringify(input),
      headers: actorHeaders(),
    }).then(asView),
  update: (
    id: string,
    patch: UpdateParticipantInput,
  ): Promise<ParticipantView> =>
    request(`/participants/${id}`, {
      method: 'PUT',
      body: JSON.stringify(patch),
      headers: actorHeaders(),
    }).then(asView),
  remove: (id: string): Promise<void> =>
    request<void>(`/participants/${id}`, {
      method: 'DELETE',
      headers: actorHeaders(),
    }),
};

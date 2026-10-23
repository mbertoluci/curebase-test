import type {
  CreateParticipantInput,
  ListParticipantQuery,
  Paginated,
  ParticipantView,
  UpdateParticipantInput,
} from '@org/contracts';
import { request } from '../../shared/http';

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

/** Participant endpoints, built on the shared {@link request} wrapper. */
export const api = {
  list: (
    query: ListParticipantQuery = {},
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

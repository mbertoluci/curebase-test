import { Paginated, ParticipantView } from '@org/contracts';
import { api } from '@/entities/participant';
import { DEFAULT_QUERY } from '@/features/participant-list';
import { reportError } from '@/shared/report-error';
import { ParticipantPage } from '@/widgets/participant-page';

// The list reflects every mutation, so this route is rendered per request rather
// than statically prerendered at build time.
export const dynamic = 'force-dynamic';

// A data-complete first paint is the trade for awaiting the fetch: this bounds
// how long a slow or unreachable API can delay it before we fall back to a
// client load. It caps the blocking, it does not make SSR non-blocking.
const SSR_TIMEOUT_MS = 3000;

/**
 * Server Component: fetch the first page (the same DEFAULT_QUERY the client hook
 * seeds from) on the server, then hand it to the client widget. On any failure
 * we report the cause and fall back to null so the client loads on mount and the
 * page still renders.
 */
export default async function HomePage() {
  let initialData: Paginated<ParticipantView> | null = null;
  try {
    initialData = await api.list(
      DEFAULT_QUERY,
      AbortSignal.timeout(SSR_TIMEOUT_MS),
    );
  } catch (error) {
    reportError(error, 'ssr-initial-load');
  }
  return <ParticipantPage initialData={initialData} />;
}

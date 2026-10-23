import {
  DEFAULT_PAGE_SIZE,
  DEFAULT_SORT_DIR,
  DEFAULT_SORT_FIELD,
  Paginated,
  ParticipantView,
} from '@org/contracts';
import { api } from '@/entities/participant';
import { ParticipantPage } from '@/widgets/participant-page';

// The list reflects every mutation, so this route is rendered per request rather
// than statically prerendered at build time.
export const dynamic = 'force-dynamic';

/**
 * Server Component: fetch the first page on the server for a data-complete first
 * paint, then hand it to the client widget. If the API is unreachable at render
 * time we fall back to null and let the client load on mount - the page still
 * renders instead of erroring.
 */
export default async function HomePage() {
  let initialData: Paginated<ParticipantView> | null = null;
  try {
    initialData = await api.list({
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,
      sortBy: DEFAULT_SORT_FIELD,
      sortDir: DEFAULT_SORT_DIR,
    });
  } catch {
    // SSR fetch failed; the client will load the list on mount.
  }
  return <ParticipantPage initialData={initialData} />;
}

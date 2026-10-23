'use client';

import {
  DEFAULT_SORT_FIELD,
  DEFAULT_SORT_DIR,
  Paginated,
  ParticipantView,
} from '@org/contracts';
import { Card, cx } from '@/shared/ui';
import { ParticipantForm } from '@/features/participant-form';
import {
  Filters,
  ParticipantsTable,
  useParticipantList,
} from '@/features/participant-list';
import { Sidebar } from './Sidebar';
import { SummaryHeader } from './SummaryHeader';

interface Props {
  /** First page rendered on the server (null when the SSR fetch failed). */
  initialData: Paginated<ParticipantView> | null;
}

/** The participant-capture screen, in a Health-style two-pane shell. */
export function ParticipantPage({ initialData }: Props) {
  const {
    query,
    page,
    loading,
    error,
    editing,
    toast,
    patchQuery,
    handleSort,
    startEdit,
    handleSaved,
    handleDelete,
    cancelEdit,
    resetFilters,
  } = useParticipantList(initialData);

  return (
    <div className="min-h-screen bg-bg">
      <div className="mx-auto flex max-w-[1180px] gap-6 px-4 pb-28 tablet:px-8 tablet:pb-10">
        <Sidebar
          query={query}
          onSelectBand={(range) => patchQuery(range)}
          onSummary={resetFilters}
        />

        <main className="flex min-w-0 flex-1 flex-col gap-6 pt-6 tablet:pt-7">
          <SummaryHeader page={page} />

          <section className="flex flex-col gap-3">
            <h3 className="px-1 text-[20px] font-bold tracking-tight">
              {editing ? 'Edit participant' : 'New participant'}
            </h3>
            <ParticipantForm
              editing={editing}
              onSaved={handleSaved}
              onCancelEdit={cancelEdit}
              onRequestEdit={startEdit}
            />
          </section>

          <section className="flex flex-col gap-3">
            <h3 className="px-1 text-[20px] font-bold tracking-tight">
              All Participants
            </h3>
            <Card className="!p-4">
              <Filters
                query={query}
                onChange={patchQuery}
                onReset={resetFilters}
              />
              <ParticipantsTable
                page={page}
                loading={loading}
                error={error}
                sortBy={query.sortBy ?? DEFAULT_SORT_FIELD}
                sortDir={query.sortDir ?? DEFAULT_SORT_DIR}
                onSort={handleSort}
                onPage={(p) => patchQuery({ page: p })}
                onEdit={startEdit}
                onDelete={handleDelete}
              />
            </Card>
          </section>
        </main>
      </div>

      {/* Mobile bottom tab bar (presentational, mirrors the Health tabs). */}
      <nav className="fixed inset-x-0 bottom-0 z-10 flex items-stretch border-t border-border bg-surface/90 backdrop-blur tablet:hidden">
        <div className="flex flex-1 flex-col items-center gap-0.5 py-2 text-primary">
          <span className="text-[18px] leading-none">♥</span>
          <span className="text-[11px] font-medium">Summary</span>
        </div>
        <div className="flex flex-1 flex-col items-center gap-0.5 py-2 text-muted">
          <span className="text-[18px] leading-none">⚇</span>
          <span className="text-[11px] font-medium">Sharing</span>
        </div>
      </nav>

      {toast && (
        <div
          role={toast.kind === 'error' ? 'alert' : 'status'}
          className={cx(
            'fixed bottom-24 left-1/2 z-20 -translate-x-1/2 rounded-full px-5 py-3 text-[14px] font-semibold text-white shadow-toast tablet:bottom-8',
            toast.kind === 'success' ? 'bg-band-normal' : 'bg-danger',
          )}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}

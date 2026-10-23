'use client';

import { DEFAULT_SORT_FIELD, DEFAULT_SORT_DIR } from '@org/contracts';
import { Card, cx } from '../../shared/ui';
import { Filters } from './Filters';
import { ParticipantForm } from './ParticipantForm';
import { ParticipantsTable } from './ParticipantsTable';
import { useParticipantList } from './use-participant-list';

/** The participant-capture screen: form on top, filterable/paginated table below. */
export function ParticipantPage() {
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
  } = useParticipantList();

  return (
    <main className="mx-auto flex max-w-[1040px] flex-col gap-6 px-4 pt-8 pb-20">
      <header>
        <h1 className="mb-1 text-[1.6rem] font-semibold">
          Clinical Trial Participant Capture
        </h1>
        <p className="text-muted">
          Collect demographics and measurements; BMI is computed and stored
          automatically.
        </p>
      </header>

      <ParticipantForm
        editing={editing}
        onSaved={handleSaved}
        onCancelEdit={cancelEdit}
        onRequestEdit={startEdit}
      />

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[1.15rem] font-semibold">Participants</h2>
        </div>
        <Filters query={query} onChange={patchQuery} onReset={resetFilters} />
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

      {toast && (
        <div
          role={toast.kind === 'error' ? 'alert' : 'status'}
          className={cx(
            'fixed bottom-6 left-1/2 -translate-x-1/2 rounded-card px-5 py-3 shadow-toast',
            toast.kind === 'success'
              ? 'bg-band-normal text-on-band'
              : 'bg-danger text-white',
          )}
        >
          {toast.message}
        </div>
      )}
    </main>
  );
}

'use client';

import { DEFAULT_SORT_FIELD, DEFAULT_SORT_DIR } from '@org/contracts';
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
    <main className="page">
      <header className="page__header">
        <h1>Clinical Trial Participant Capture</h1>
        <p>
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

      <section className="card">
        <div className="section__header">
          <h2>Participants</h2>
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
      </section>

      {toast && (
        <div className={`toast toast--${toast.kind}`} role="status">
          {toast.message}
        </div>
      )}
    </main>
  );
}

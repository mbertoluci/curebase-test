'use client';

import {
  DEFAULT_SORT_FIELD,
  DEFAULT_SORT_DIR,
  Paginated,
  ParticipantView,
} from '@org/contracts';
import { useState } from 'react';
import { Button, Card, Modal, cx } from '@/shared/ui';
import { ParticipantForm } from '@/features/participant-form';
import {
  Filters,
  ParticipantsTable,
  useParticipantList,
} from '@/features/participant-list';

interface Props {
  /** First page rendered on the server (null when the SSR fetch failed). */
  initialData: Paginated<ParticipantView> | null;
}

/** The participant screen: the list and its filters are the main view; adding
 * or editing a participant happens in a modal over it. */
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

  const [formOpen, setFormOpen] = useState(false);
  const openCreate = () => {
    cancelEdit();
    setFormOpen(true);
  };
  const openEdit = (view: ParticipantView) => {
    startEdit(view);
    setFormOpen(true);
  };
  const closeForm = () => {
    setFormOpen(false);
    cancelEdit();
  };

  const total = page?.pageInfo.total;

  return (
    <div className="min-h-screen bg-bg">
      <div className="mx-auto flex max-w-[1040px] flex-col gap-6 px-4 py-8 tablet:px-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-[28px] font-bold tracking-tight text-ink">
              Participants
            </h1>
            <p className="mt-1 text-[14px] text-muted">
              {total === undefined
                ? 'BMI capture and classification'
                : `${total} ${total === 1 ? 'participant' : 'participants'} captured`}
            </p>
          </div>
          <Button variant="primary" onClick={openCreate}>
            + Add participant
          </Button>
        </header>

        <Card className="!p-4">
          <Filters query={query} onChange={patchQuery} onReset={resetFilters} />
          <ParticipantsTable
            page={page}
            loading={loading}
            error={error}
            sortBy={query.sortBy ?? DEFAULT_SORT_FIELD}
            sortDir={query.sortDir ?? DEFAULT_SORT_DIR}
            onSort={handleSort}
            onPage={(p) => patchQuery({ page: p })}
            onEdit={openEdit}
            onDelete={handleDelete}
          />
        </Card>
      </div>

      <Modal
        open={formOpen}
        onClose={closeForm}
        title={editing ? 'Edit participant' : 'New participant'}
      >
        {formOpen && (
          <ParticipantForm
            key={editing?.id ?? 'new'}
            editing={editing}
            onSaved={(view, action) => {
              handleSaved(view, action);
              setFormOpen(false);
            }}
            onCancelEdit={closeForm}
            onRequestEdit={startEdit}
          />
        )}
      </Modal>

      {toast && (
        <div
          role={toast.kind === 'error' ? 'alert' : 'status'}
          className={cx(
            'fixed bottom-6 left-1/2 z-20 -translate-x-1/2 rounded-full px-5 py-3 text-[14px] font-semibold text-white shadow-toast',
            toast.kind === 'success' ? 'bg-band-normal' : 'bg-danger',
          )}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}

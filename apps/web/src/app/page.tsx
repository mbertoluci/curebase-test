'use client';

import {
  DEFAULT_PAGE_SIZE,
  ListParticipantsQuery,
  Paginated,
  ParticipantSortField,
  ParticipantView,
} from '@org/contracts';
import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { Filters } from '../components/Filters';
import { ParticipantForm } from '../components/ParticipantForm';
import { ParticipantsTable } from '../components/ParticipantsTable';

const DEFAULT_QUERY: ListParticipantsQuery = {
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
  sortBy: 'createdAt',
  sortDir: 'desc',
};

type Toast = { kind: 'success' | 'error'; message: string };

export default function HomePage() {
  const [query, setQuery] = useState<ListParticipantsQuery>(DEFAULT_QUERY);
  const [page, setPage] = useState<Paginated<ParticipantView> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<ParticipantView | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [refresh, setRefresh] = useState(0);

  const load = useCallback(async (q: ListParticipantsQuery) => {
    setLoading(true);
    setError(null);
    try {
      setPage(await api.list(q));
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Could not load participants.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced reload whenever the query (or a manual refresh) changes.
  useEffect(() => {
    const handle = setTimeout(() => load(query), 250);
    return () => clearTimeout(handle);
  }, [query, refresh, load]);

  // Auto-dismiss the toast.
  useEffect(() => {
    if (!toast) return;
    const handle = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(handle);
  }, [toast]);

  const patchQuery = (patch: Partial<ListParticipantsQuery>) =>
    setQuery((prev) => ({
      ...prev,
      ...patch,
      page: 'page' in patch ? (patch.page ?? 1) : 1,
    }));

  const handleSort = (field: ParticipantSortField) =>
    setQuery((prev) => ({
      ...prev,
      sortBy: field,
      sortDir: prev.sortBy === field && prev.sortDir === 'asc' ? 'desc' : 'asc',
      page: 1,
    }));

  const startEdit = (view: ParticipantView) => {
    setEditing(view);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSaved = (
    _view: ParticipantView,
    action: 'created' | 'updated',
  ) => {
    setEditing(null);
    setToast({ kind: 'success', message: `Participant ${action}.` });
    setRefresh((n) => n + 1);
  };

  const handleDelete = async (view: ParticipantView) => {
    if (
      !window.confirm(
        `Delete ${view.firstName} ${view.lastName}? This can be audited but not undone here.`,
      )
    ) {
      return;
    }
    try {
      await api.remove(view.id);
      if (editing?.id === view.id) setEditing(null);
      setToast({ kind: 'success', message: 'Participant deleted.' });
      setRefresh((n) => n + 1);
    } catch (err) {
      setToast({
        kind: 'error',
        message: err instanceof ApiError ? err.message : 'Delete failed.',
      });
    }
  };

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
        onCancelEdit={() => setEditing(null)}
        onRequestEdit={startEdit}
      />

      <section className="card">
        <div className="section__header">
          <h2>Participants</h2>
        </div>
        <Filters
          query={query}
          onChange={patchQuery}
          onReset={() => setQuery(DEFAULT_QUERY)}
        />
        <ParticipantsTable
          page={page}
          loading={loading}
          error={error}
          sortBy={query.sortBy ?? 'createdAt'}
          sortDir={query.sortDir ?? 'desc'}
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

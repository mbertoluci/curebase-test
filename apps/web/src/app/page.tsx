'use client';

import {
  DEFAULT_PAGE_SIZE,
  DEFAULT_SORT_FIELD,
  DEFAULT_SORT_DIR,
  ListParticipantsQuery,
  Paginated,
  ParticipantSortField,
  ParticipantView,
} from '@org/contracts';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { LIST_DEBOUNCE_MS, TOAST_DISMISS_MS } from '../lib/constants';
import { Filters } from '../components/Filters';
import { ParticipantForm } from '../components/ParticipantForm';
import { ParticipantsTable } from '../components/ParticipantsTable';

const DEFAULT_QUERY: ListParticipantsQuery = {
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
  sortBy: DEFAULT_SORT_FIELD,
  sortDir: DEFAULT_SORT_DIR,
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

  // Monotonic request id: only the most recently issued load may touch state,
  // so a slow earlier response can't overwrite a newer one (stale-while-typing).
  const loadSeq = useRef(0);
  const load = useCallback(async (q: ListParticipantsQuery) => {
    const seq = ++loadSeq.current;
    setLoading(true);
    setError(null);
    try {
      const result = await api.list(q);
      if (seq !== loadSeq.current) return; // superseded by a newer load
      setPage(result);
    } catch (err) {
      if (seq !== loadSeq.current) return;
      setError(
        err instanceof ApiError ? err.message : 'Could not load participants.',
      );
    } finally {
      if (seq === loadSeq.current) setLoading(false);
    }
  }, []);

  // Debounced reload whenever the query (or a manual refresh) changes.
  useEffect(() => {
    const handle = setTimeout(() => load(query), LIST_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [query, refresh, load]);

  // Auto-dismiss the toast.
  useEffect(() => {
    if (!toast) return;
    const handle = setTimeout(() => setToast(null), TOAST_DISMISS_MS);
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

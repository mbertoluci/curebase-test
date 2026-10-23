'use client';

import {
  DEFAULT_PAGE_SIZE,
  DEFAULT_SORT_FIELD,
  DEFAULT_SORT_DIR,
  ListParticipantQuery,
  Paginated,
  ParticipantSortField,
  ParticipantView,
} from '@org/contracts';
import { useCallback, useEffect, useRef, useState } from 'react';
import { LIST_DEBOUNCE_MS, TOAST_DISMISS_MS } from '../../shared/constants';
import { ApiError } from '../../shared/http';
import { reportError } from '../../shared/report-error';
import { api } from './participant.api';

const DEFAULT_QUERY: ListParticipantQuery = {
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
  sortBy: DEFAULT_SORT_FIELD,
  sortDir: DEFAULT_SORT_DIR,
};

export type Toast = { kind: 'success' | 'error'; message: string };

/**
 * Owns the participant-list screen's data and interaction state: the query, the
 * current page, load/debounce lifecycle, edit target, and the transient toast.
 * The view (ParticipantPage) stays declarative and just renders what this hook
 * exposes.
 */
export function useParticipantList() {
  const [query, setQuery] = useState<ListParticipantQuery>(DEFAULT_QUERY);
  const [page, setPage] = useState<Paginated<ParticipantView> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<ParticipantView | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [refresh, setRefresh] = useState(0);

  // Monotonic request id: only the most recently issued load may touch state,
  // so a slow earlier response can't overwrite a newer one (stale-while-typing).
  const loadSeq = useRef(0);
  // In-flight request, aborted when a newer load starts or the screen unmounts.
  const abortRef = useRef<AbortController | null>(null);
  const load = useCallback(async (q: ListParticipantQuery) => {
    const seq = ++loadSeq.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    try {
      const result = await api.list(q, controller.signal);
      if (seq !== loadSeq.current) return; // superseded by a newer load
      // Clamp an out-of-range page (e.g. deleting the last row of the last
      // page): reload the real last page instead of showing an empty table.
      if (result.pageInfo.page > result.pageInfo.totalPages) {
        setQuery((prev) => ({ ...prev, page: result.pageInfo.totalPages }));
        return;
      }
      setPage(result);
    } catch (err) {
      if (seq !== loadSeq.current) return;
      if (!(err instanceof ApiError)) reportError(err, 'participant-list');
      setError(
        err instanceof ApiError ? err.message : 'Could not load participants.',
      );
    } finally {
      if (seq === loadSeq.current) setLoading(false);
    }
  }, []);

  // Abort any in-flight request when the screen unmounts.
  useEffect(() => () => abortRef.current?.abort(), []);

  // Debounced reload whenever the query (or a manual refresh) changes.
  useEffect(() => {
    const handle = setTimeout(() => load(query), LIST_DEBOUNCE_MS);
    return () => {
      clearTimeout(handle);
      // Invalidate any already-started load so a response for the superseded
      // query can't land during the next debounce window (monotonic guard).
      loadSeq.current += 1;
    };
  }, [query, refresh, load]);

  // Auto-dismiss the toast.
  useEffect(() => {
    if (!toast) return;
    const handle = setTimeout(() => setToast(null), TOAST_DISMISS_MS);
    return () => clearTimeout(handle);
  }, [toast]);

  const patchQuery = (patch: Partial<ListParticipantQuery>) =>
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

  return {
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
    cancelEdit: () => setEditing(null),
    resetFilters: () => setQuery(DEFAULT_QUERY),
  };
}

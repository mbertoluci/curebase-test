'use client';

import {
  Paginated,
  ParticipantSortField,
  ParticipantView,
  SortDirection,
} from '@org/contracts';
import {
  formatBmi,
  formatDate,
  heightLabel,
  unitLabel,
  weightUnit,
} from '../lib/display';
import { BandChip } from './BandChip';

interface Props {
  page: Paginated<ParticipantView> | null;
  loading: boolean;
  error: string | null;
  sortBy: ParticipantSortField;
  sortDir: SortDirection;
  onSort: (field: ParticipantSortField) => void;
  onPage: (page: number) => void;
  onEdit: (view: ParticipantView) => void;
  onDelete: (view: ParticipantView) => void;
}

const SORTABLE: Record<ParticipantSortField, string> = {
  lastName: 'Name',
  age: 'Age',
  bmiValue: 'BMI',
  createdAt: 'Created',
};

export function ParticipantsTable({
  page,
  loading,
  error,
  sortBy,
  sortDir,
  onSort,
  onPage,
  onEdit,
  onDelete,
}: Props) {
  if (error) {
    return <div className="notice notice--error">{error}</div>;
  }
  if (loading && !page) {
    return <div className="table-state">Loading participants…</div>;
  }
  if (page && page.pageInfo.total === 0) {
    return (
      <div className="table-state">
        No participants match. Add one above, or adjust the filters.
      </div>
    );
  }
  if (!page) return null;

  const header = (field: ParticipantSortField, label: string) => (
    <th
      scope="col"
      aria-sort={
        sortBy === field
          ? sortDir === 'asc'
            ? 'ascending'
            : 'descending'
          : 'none'
      }
    >
      <button type="button" className="th-sort" onClick={() => onSort(field)}>
        {label}
        {sortBy === field ? (
          <span aria-hidden>{sortDir === 'asc' ? ' ▲' : ' ▼'}</span>
        ) : null}
      </button>
    </th>
  );

  const { data, pageInfo } = page;

  return (
    <>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              {header('lastName', SORTABLE.lastName)}
              <th scope="col">Email</th>
              <th scope="col">Phone</th>
              {header('age', SORTABLE.age)}
              <th scope="col">Height</th>
              <th scope="col">Weight</th>
              {header('bmiValue', SORTABLE.bmiValue)}
              <th scope="col">Unit</th>
              {header('createdAt', SORTABLE.createdAt)}
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.map((p) => (
              <tr key={p.id}>
                <td data-label="Name">
                  {p.firstName} {p.lastName}
                </td>
                <td data-label="Email">{p.email}</td>
                <td data-label="Phone">{p.phone ?? '—'}</td>
                <td data-label="Age">{p.age}</td>
                <td data-label="Height">{heightLabel(p.unit, p.height)}</td>
                <td data-label="Weight">
                  {p.weight} {weightUnit(p.unit)}
                </td>
                <td data-label="BMI">
                  <span className="bmi-cell">
                    {formatBmi(p.bmiValue)} <BandChip band={p.bmiBand} />
                  </span>
                </td>
                <td data-label="Unit">{unitLabel(p.unit)}</td>
                <td data-label="Created">{formatDate(p.createdAt)}</td>
                <td data-label="Actions">
                  <div className="row-actions">
                    <button
                      type="button"
                      className="link"
                      onClick={() => onEdit(p)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="link link--danger"
                      onClick={() => onDelete(p)}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="pagination">
        <span className="pagination__info">
          Page {pageInfo.page} of {pageInfo.totalPages} · {pageInfo.total} total
        </span>
        <div className="pagination__buttons">
          <button
            type="button"
            className="btn btn--ghost"
            disabled={pageInfo.page <= 1}
            onClick={() => onPage(pageInfo.page - 1)}
          >
            Previous
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            disabled={pageInfo.page >= pageInfo.totalPages}
            onClick={() => onPage(pageInfo.page + 1)}
          >
            Next
          </button>
        </div>
      </div>
    </>
  );
}

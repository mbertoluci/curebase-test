'use client';

import {
  Paginated,
  ParticipantSortField,
  ParticipantView,
  SortDirection,
} from '@org/contracts';
import { Button, Notice } from '../../shared/ui';
import {
  formatBmi,
  formatDate,
  heightLabel,
  unitLabel,
  weightUnit,
} from './participant.display';
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

const TH =
  'border-b border-border px-3 py-2.5 text-left whitespace-nowrap text-[0.8rem] font-semibold text-muted';

// Cells: a normal table cell on desktop; a label/value row (via ::before) once
// the table stacks into cards below 760px.
const TD =
  'border-b border-border px-3 py-2.5 text-left whitespace-nowrap ' +
  'max-[760px]:flex max-[760px]:justify-between max-[760px]:gap-4 max-[760px]:whitespace-normal ' +
  'max-[760px]:border-0 max-[760px]:py-1.5 max-[760px]:before:font-semibold ' +
  'max-[760px]:before:text-muted max-[760px]:before:content-[attr(data-label)]';

const STATE = 'p-7 text-center text-muted';

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
    return <Notice tone="error">{error}</Notice>;
  }
  if (loading && !page) {
    return <div className={STATE}>Loading participants…</div>;
  }
  if (page && page.pageInfo.total === 0) {
    return (
      <div className={STATE}>
        No participants match. Add one above, or adjust the filters.
      </div>
    );
  }
  if (!page) return null;

  const header = (field: ParticipantSortField, label: string) => (
    <th
      scope="col"
      className={TH}
      aria-sort={
        sortBy === field
          ? sortDir === 'asc'
            ? 'ascending'
            : 'descending'
          : 'none'
      }
    >
      <button
        type="button"
        className="cursor-pointer border-0 bg-transparent p-0 text-inherit [font:inherit]"
        onClick={() => onSort(field)}
      >
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
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[0.9rem] max-[760px]:block">
          <thead className="max-[760px]:hidden">
            <tr>
              {header('lastName', SORTABLE.lastName)}
              <th scope="col" className={TH}>
                Email
              </th>
              <th scope="col" className={TH}>
                Phone
              </th>
              {header('age', SORTABLE.age)}
              <th scope="col" className={TH}>
                Height
              </th>
              <th scope="col" className={TH}>
                Weight
              </th>
              {header('bmiValue', SORTABLE.bmiValue)}
              <th scope="col" className={TH}>
                Unit
              </th>
              {header('createdAt', SORTABLE.createdAt)}
              <th scope="col" className={TH}>
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="max-[760px]:block">
            {data.map((p) => (
              <tr
                key={p.id}
                className="max-[760px]:mb-3 max-[760px]:block max-[760px]:rounded-lg max-[760px]:border max-[760px]:border-border max-[760px]:px-2.5 max-[760px]:py-1.5"
              >
                <td className={TD} data-label="Name">
                  {p.firstName} {p.lastName}
                </td>
                <td className={TD} data-label="Email">
                  {p.email}
                </td>
                <td className={TD} data-label="Phone">
                  {p.phone ?? '—'}
                </td>
                <td className={TD} data-label="Age">
                  {p.age}
                </td>
                <td className={TD} data-label="Height">
                  {heightLabel(p.unit, p.height)}
                </td>
                <td className={TD} data-label="Weight">
                  {p.weight} {weightUnit(p.unit)}
                </td>
                <td className={TD} data-label="BMI">
                  <span className="inline-flex items-center gap-2">
                    {formatBmi(p.bmiValue)} <BandChip band={p.bmiBand} />
                  </span>
                </td>
                <td className={TD} data-label="Unit">
                  {unitLabel(p.unit)}
                </td>
                <td className={TD} data-label="Created">
                  {formatDate(p.createdAt)}
                </td>
                <td className={TD} data-label="Actions">
                  <div className="flex gap-3">
                    <Button variant="link" onClick={() => onEdit(p)}>
                      Edit
                    </Button>
                    <Button variant="link" danger onClick={() => onDelete(p)}>
                      Delete
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3.5 flex items-center justify-between gap-3">
        <span className="text-[0.85rem] text-muted">
          Page {pageInfo.page} of {pageInfo.totalPages} · {pageInfo.total} total
        </span>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            disabled={pageInfo.page <= 1}
            onClick={() => onPage(pageInfo.page - 1)}
          >
            Previous
          </Button>
          <Button
            variant="ghost"
            disabled={pageInfo.page >= pageInfo.totalPages}
            onClick={() => onPage(pageInfo.page + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </>
  );
}

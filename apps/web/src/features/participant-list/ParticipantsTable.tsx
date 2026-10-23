'use client';

import {
  Paginated,
  ParticipantSortField,
  ParticipantView,
  SortDirection,
} from '@org/contracts';
import { Button, Notice, Select, cx } from '@/shared/ui';
import {
  BandChip,
  formatBmi,
  formatDate,
  heightLabel,
  unitLabel,
  weightUnit,
} from '@/entities/participant';

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
  'max-tablet:flex max-tablet:justify-between max-tablet:gap-4 max-tablet:whitespace-normal ' +
  'max-tablet:border-0 max-tablet:py-1.5 max-tablet:before:font-semibold ' +
  'max-tablet:before:text-muted max-tablet:before:content-[attr(data-label)]';

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
      {/* The column headers (and their sort controls) are hidden once the table
          stacks into cards, so expose sorting as an explicit control on mobile. */}
      <div className="mb-3 hidden items-end gap-2 max-tablet:flex">
        <label className="flex flex-col gap-[5px] text-[0.83rem] text-muted">
          Sort by
          <Select
            id="mobile-sort"
            name="mobile-sort"
            className="w-auto"
            value={sortBy}
            onChange={(e) => onSort(e.target.value as ParticipantSortField)}
          >
            {Object.entries(SORTABLE).map(([field, label]) => (
              <option key={field} value={field}>
                {label}
              </option>
            ))}
          </Select>
        </label>
        <Button
          variant="ghost"
          onClick={() => onSort(sortBy)}
          aria-label={`Sorted ${sortDir === 'asc' ? 'ascending' : 'descending'}, toggle direction`}
        >
          {sortDir === 'asc' ? '▲ Asc' : '▼ Desc'}
        </Button>
      </div>

      <div
        className={cx('overflow-x-auto', loading && 'opacity-60')}
        aria-busy={loading}
      >
        <table className="w-full border-collapse text-[0.9rem] max-tablet:block">
          <thead className="max-tablet:hidden">
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
          <tbody className="max-tablet:block">
            {data.map((p) => (
              <tr
                key={p.id}
                className="max-tablet:mb-3 max-tablet:block max-tablet:rounded-lg max-tablet:border max-tablet:border-border max-tablet:px-2.5 max-tablet:py-1.5"
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

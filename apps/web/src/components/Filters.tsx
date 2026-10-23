'use client';

import { ListParticipantQuery, Unit } from '@org/contracts';

interface Props {
  query: ListParticipantQuery;
  onChange: (patch: Partial<ListParticipantQuery>) => void;
  onReset: () => void;
}

/** Controlled filter bar. Emits partial query patches; the page owns the state. */
export function Filters({ query, onChange, onReset }: Props) {
  const numberOrUndefined = (v: string): number | undefined =>
    v === '' ? undefined : Number(v);

  return (
    <div className="filters">
      <div className="field field--grow">
        <label htmlFor="search">Search</label>
        <input
          id="search"
          placeholder="Name or email"
          value={query.search ?? ''}
          onChange={(e) => onChange({ search: e.target.value || undefined })}
        />
      </div>

      <div className="field">
        <label htmlFor="unit-filter">Unit</label>
        <select
          id="unit-filter"
          value={query.unit ?? ''}
          onChange={(e) =>
            onChange({
              unit: (e.target.value || undefined) as Unit | undefined,
            })
          }
        >
          <option value="">All</option>
          <option value={Unit.US}>US</option>
          <option value={Unit.METRIC}>Metric</option>
        </select>
      </div>

      <div className="field field--narrow">
        <label htmlFor="minBmi">Min BMI</label>
        <input
          id="minBmi"
          type="number"
          step="0.1"
          value={query.minBmi ?? ''}
          onChange={(e) =>
            onChange({ minBmi: numberOrUndefined(e.target.value) })
          }
        />
      </div>

      <div className="field field--narrow">
        <label htmlFor="maxBmi">Max BMI</label>
        <input
          id="maxBmi"
          type="number"
          step="0.1"
          value={query.maxBmi ?? ''}
          onChange={(e) =>
            onChange({ maxBmi: numberOrUndefined(e.target.value) })
          }
        />
      </div>

      <button type="button" className="btn btn--ghost" onClick={onReset}>
        Reset
      </button>
    </div>
  );
}

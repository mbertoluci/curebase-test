'use client';

import { ListParticipantQuery, Unit } from '@org/contracts';
import { Button, Field, Input, Select } from '../../shared/ui';

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
    <div className="mb-4 flex flex-wrap items-end gap-3">
      <Field id="search" label="Search" className="flex-[1_1_220px]">
        <Input
          id="search"
          placeholder="Name or email"
          value={query.search ?? ''}
          onChange={(e) => onChange({ search: e.target.value || undefined })}
        />
      </Field>

      <Field id="unit-filter" label="Unit">
        <Select
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
        </Select>
      </Field>

      <Field id="minBmi" label="Min BMI" className="w-[100px]">
        <Input
          id="minBmi"
          type="number"
          step="0.1"
          value={query.minBmi ?? ''}
          onChange={(e) =>
            onChange({ minBmi: numberOrUndefined(e.target.value) })
          }
        />
      </Field>

      <Field id="maxBmi" label="Max BMI" className="w-[100px]">
        <Input
          id="maxBmi"
          type="number"
          step="0.1"
          value={query.maxBmi ?? ''}
          onChange={(e) =>
            onChange({ maxBmi: numberOrUndefined(e.target.value) })
          }
        />
      </Field>

      <Button variant="ghost" onClick={onReset}>
        Reset
      </Button>
    </div>
  );
}

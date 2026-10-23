'use client';

import { ListParticipantQuery } from '@org/contracts';
import { cx } from '@/shared/ui';

/** Original, generic glyphs (not platform symbols). */
function HeartGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden
      fill="currentColor"
    >
      <path d="M12 20s-7-4.6-9.3-9C1.3 8 2.6 4.8 5.8 4.8c2 0 3.3 1.2 4.2 2.6.9-1.4 2.2-2.6 4.2-2.6 3.2 0 4.5 3.2 3.1 6.2C19 15.4 12 20 12 20z" />
    </svg>
  );
}
function PeopleGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden
      fill="currentColor"
    >
      <circle cx="8.5" cy="8" r="3.2" />
      <circle cx="16" cy="9" r="2.6" />
      <path d="M2.5 19c0-3.3 2.7-5.3 6-5.3s6 2 6 5.3H2.5zm12.3-5c2.4.1 4.7 1.7 4.7 5h-4.1c0-1.9-.7-3.6-1.9-4.8l1.3-.2z" />
    </svg>
  );
}
function SearchGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4.5 4.5" strokeLinecap="round" />
    </svg>
  );
}

type BandNav = {
  label: string;
  dot: string; // text color utility
  range: Pick<ListParticipantQuery, 'minBmi' | 'maxBmi'>;
};

const BANDS: BandNav[] = [
  {
    label: 'Underweight',
    dot: 'text-band-under',
    range: { minBmi: undefined, maxBmi: 18.4 },
  },
  {
    label: 'Normal',
    dot: 'text-band-normal',
    range: { minBmi: 18.5, maxBmi: 24.9 },
  },
  {
    label: 'Overweight',
    dot: 'text-band-over',
    range: { minBmi: 25, maxBmi: 29.9 },
  },
  {
    label: 'Obese',
    dot: 'text-band-obese',
    range: { minBmi: 30, maxBmi: undefined },
  },
];

interface Props {
  query: ListParticipantQuery;
  onSelectBand: (
    range: Pick<ListParticipantQuery, 'minBmi' | 'maxBmi'>,
  ) => void;
  onSummary: () => void;
}

/** The left navigation panel (desktop): title, search, Summary/Sharing, and the
 * BMI categories which filter the list - mirroring the Health sidebar. */
export function Sidebar({ query, onSelectBand, onSummary }: Props) {
  const anyBand = query.minBmi !== undefined || query.maxBmi !== undefined;

  const navItem = (active: boolean) =>
    cx(
      'flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left text-[15px] font-medium transition',
      active
        ? 'bg-primary text-white'
        : 'text-ink hover:bg-[color-mix(in_srgb,var(--muted)_12%,transparent)]',
    );

  return (
    <aside className="hidden w-[272px] shrink-0 flex-col gap-4 py-7 pr-2 tablet:flex">
      <h1 className="px-2 text-[26px] font-bold tracking-tight">Health</h1>

      <div className="relative px-0.5">
        <SearchGlyph className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          readOnly
          aria-label="Search Health"
          placeholder="Search"
          className="w-full rounded-[10px] bg-[color-mix(in_srgb,var(--muted)_14%,transparent)] py-2 pl-9 pr-3 text-[15px] text-ink placeholder:text-muted outline-none"
        />
      </div>

      <nav className="flex flex-col gap-0.5 px-0.5">
        <button type="button" className={navItem(!anyBand)} onClick={onSummary}>
          <HeartGlyph
            className={cx(
              'h-[18px] w-[18px]',
              !anyBand ? 'text-white' : 'text-red',
            )}
          />
          Summary
        </button>
        <button type="button" className={navItem(false)}>
          <PeopleGlyph className="h-[18px] w-[18px] text-primary" />
          Sharing
        </button>
      </nav>

      <div className="px-2.5 pt-1 text-[13px] font-semibold uppercase tracking-wide text-muted">
        Health Categories
      </div>
      <nav className="flex flex-col gap-0.5 px-0.5">
        {BANDS.map((b) => {
          const active =
            anyBand &&
            query.minBmi === b.range.minBmi &&
            query.maxBmi === b.range.maxBmi;
          return (
            <button
              key={b.label}
              type="button"
              className={navItem(active)}
              onClick={() => onSelectBand(b.range)}
            >
              <span
                className={cx(
                  'text-[20px] leading-none',
                  active ? 'text-white' : b.dot,
                )}
              >
                ●
              </span>
              {b.label}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

'use client';

import { BmiBand, Paginated, ParticipantView } from '@org/contracts';
import { Card, cx } from '@/shared/ui';

function PersonGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden
      fill="currentColor"
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5H4z" />
    </svg>
  );
}

interface StatCardProps {
  label: string;
  accent: string; // text color utility, e.g. text-green
  value: number | string;
  unit?: string;
}

/** A Health "Favorites" card: accent category label + a big bold value. */
function StatCard({ label, accent, value, unit }: StatCardProps) {
  return (
    <Card className="flex flex-col gap-3 !p-4">
      <div
        className={cx(
          'flex items-center gap-1.5 text-[14px] font-semibold',
          accent,
        )}
      >
        <span className="text-[17px] leading-none">●</span>
        {label}
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-[30px] font-bold leading-none tracking-tight text-ink">
          {value}
        </span>
        {unit && (
          <span className="text-[14px] font-medium text-muted">{unit}</span>
        )}
      </div>
    </Card>
  );
}

interface Props {
  page: Paginated<ParticipantView> | null;
}

/** The gradient summary header (profile strip) plus the big-number stat cards. */
export function SummaryHeader({ page }: Props) {
  const total = page?.pageInfo.total ?? 0;
  const rows = page?.data ?? [];
  const count = (band: BmiBand) =>
    rows.filter((r) => r.bmiBand === band).length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4 border-b border-border pb-5">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <PersonGlyph className="h-8 w-8" />
        </div>
        <div className="min-w-0">
          <h2 className="truncate text-[26px] font-bold leading-tight tracking-tight text-ink">
            Participants
          </h2>
          <p className="text-[14px] font-medium text-muted">
            BMI capture and classification
          </p>
        </div>
      </div>

      <div>
        <h3 className="mb-3 px-1 text-[20px] font-bold tracking-tight">
          Summary
        </h3>
        <div className="grid grid-cols-2 gap-3.5 tablet:grid-cols-4">
          <StatCard
            label="Participants"
            accent="text-primary"
            value={total}
            unit="total"
          />
          <StatCard
            label="Normal"
            accent="text-band-normal"
            value={count(BmiBand.NORMAL)}
            unit="on page"
          />
          <StatCard
            label="Overweight"
            accent="text-band-over"
            value={count(BmiBand.OVERWEIGHT)}
            unit="on page"
          />
          <StatCard
            label="Obese"
            accent="text-band-obese"
            value={count(BmiBand.OBESE)}
            unit="on page"
          />
        </div>
      </div>
    </div>
  );
}

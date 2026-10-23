import type { ComponentPropsWithoutRef } from 'react';
import { cx } from './cx';

export type NoticeTone = 'warn' | 'error';

const TONES: Record<NoticeTone, string> = {
  warn: 'border-band-over bg-band-over/15',
  error: 'border-danger bg-danger/15',
};

/** A tinted inline message block (duplicate warning, form/server errors). */
export function Notice({
  tone,
  className,
  ...props
}: ComponentPropsWithoutRef<'div'> & { tone: NoticeTone }) {
  return (
    <div
      className={cx(
        'mb-3.5 rounded-lg border px-3 py-2.5 text-[0.9rem]',
        TONES[tone],
        className,
      )}
      {...props}
    />
  );
}

import type { ComponentPropsWithoutRef } from 'react';
import { cx } from './cx';

export type NoticeTone = 'warn' | 'error';

const TONES: Record<NoticeTone, string> = {
  warn: 'bg-orange/12 text-ink',
  error: 'bg-danger/12 text-ink',
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
        'mb-3.5 rounded-field px-3.5 py-3 text-[14px]',
        TONES[tone],
        className,
      )}
      {...props}
    />
  );
}

import type { ComponentPropsWithoutRef } from 'react';
import { cx } from './cx';

/** The shared surface: rounded border + subtle shadow over the surface color. */
export const cardSurface =
  'rounded-card border border-border bg-surface p-5 shadow-card';

export function Card({
  className,
  ...props
}: ComponentPropsWithoutRef<'section'>) {
  return <section className={cx(cardSurface, className)} {...props} />;
}

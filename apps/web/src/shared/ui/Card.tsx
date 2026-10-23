import type { ComponentPropsWithoutRef } from 'react';
import { cx } from './cx';

/** The core white surface: a hairline border plus a soft shadow so it reads as
 * a distinct card even on the white canvas. */
export const cardSurface =
  'rounded-card border border-border bg-surface p-5 shadow-card';

export function Card({
  className,
  ...props
}: ComponentPropsWithoutRef<'section'>) {
  return <section className={cx(cardSurface, className)} {...props} />;
}

import type { ComponentPropsWithoutRef } from 'react';
import { cx } from './cx';

/** A grouped white card on the light background - the core Health surface. */
export const cardSurface = 'rounded-card bg-surface p-5 shadow-card';

export function Card({
  className,
  ...props
}: ComponentPropsWithoutRef<'section'>) {
  return <section className={cx(cardSurface, className)} {...props} />;
}

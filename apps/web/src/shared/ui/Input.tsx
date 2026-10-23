import type { ComponentPropsWithoutRef } from 'react';
import { cx } from './cx';

/** Shared control styling for text inputs and selects. */
export const controlClass =
  'w-full rounded-lg border border-border bg-surface px-2.5 py-[9px] text-[0.95rem] text-ink outline-none focus:outline-2 focus:outline-offset-1 focus:outline-primary aria-invalid:border-danger';

export function Input({
  className,
  ...props
}: ComponentPropsWithoutRef<'input'>) {
  return <input className={cx(controlClass, className)} {...props} />;
}

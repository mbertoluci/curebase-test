import type { ComponentPropsWithoutRef } from 'react';
import { cx } from './cx';

/** Shared control styling for text inputs and selects. */
export const controlClass =
  'w-full rounded-field border border-border bg-surface px-3 py-2.5 text-[15px] text-ink outline-none transition placeholder:text-faint focus:border-primary focus:ring-2 focus:ring-primary/25 aria-invalid:border-danger aria-invalid:focus:ring-danger/25';

export function Input({
  className,
  ...props
}: ComponentPropsWithoutRef<'input'>) {
  return <input className={cx(controlClass, className)} {...props} />;
}

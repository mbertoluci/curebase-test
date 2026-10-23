import type { ComponentPropsWithoutRef } from 'react';
import { cx } from './cx';

export type ButtonVariant = 'primary' | 'ghost' | 'link';

const BASE =
  'inline-flex items-center justify-center gap-1.5 rounded-field px-4 py-2.5 text-[15px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-40';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: `${BASE} bg-primary text-white hover:brightness-[.96] active:brightness-90`,
  // iOS tinted gray button.
  ghost: `${BASE} bg-[color-mix(in_srgb,var(--muted)_15%,transparent)] text-ink hover:bg-[color-mix(in_srgb,var(--muted)_24%,transparent)]`,
  // A text button reading as a link.
  link: 'inline-flex cursor-pointer items-center gap-1 bg-transparent p-0 text-[15px] font-medium text-primary transition hover:opacity-70 disabled:cursor-not-allowed disabled:opacity-40',
};

export function Button({
  variant = 'ghost',
  danger = false,
  type = 'button',
  className,
  ...props
}: ComponentPropsWithoutRef<'button'> & {
  variant?: ButtonVariant;
  danger?: boolean;
}) {
  return (
    <button
      type={type}
      className={cx(VARIANTS[variant], danger && 'text-danger', className)}
      {...props}
    />
  );
}

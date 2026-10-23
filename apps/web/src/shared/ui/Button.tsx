import type { ComponentPropsWithoutRef } from 'react';
import { cx } from './cx';

export type ButtonVariant = 'primary' | 'ghost' | 'link';

const BTN =
  'cursor-pointer rounded-lg px-4 py-[9px] text-[0.92rem] disabled:cursor-not-allowed disabled:opacity-50';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: `${BTN} border border-primary-btn bg-primary-btn text-primary-ink hover:border-primary-btn`,
  ghost: `${BTN} border border-border bg-transparent text-ink hover:border-primary`,
  // A text button: no box, reads as a link.
  link: 'cursor-pointer border-0 bg-transparent p-0 text-[0.9rem] text-primary hover:underline disabled:cursor-not-allowed disabled:opacity-50',
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

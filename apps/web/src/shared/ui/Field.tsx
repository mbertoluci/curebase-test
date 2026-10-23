import { cloneElement, isValidElement } from 'react';
import type { ElementType, ReactElement, ReactNode } from 'react';
import { cx } from './cx';
import { Input } from './Input';
import { Select } from './Select';

/** A single control we can safely forward aria-invalid/aria-describedby onto. */
function isForwardableControl(type: ElementType): boolean {
  if (type === Input || type === Select) return true;
  return (
    typeof type === 'string' && ['input', 'select', 'textarea'].includes(type)
  );
}

/**
 * Labelled field wrapper: a visible label plus accessible error wiring. When it
 * wraps a single native control and there's an error, it injects aria-invalid +
 * aria-describedby so screen readers announce invalidity and read the message;
 * compound controls (e.g. feet/inches) wire each input themselves.
 */
export function Field({
  id,
  label,
  error,
  className,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  className?: string;
  children: ReactNode;
}) {
  const control =
    error &&
    isValidElement(children) &&
    isForwardableControl(children.type as ElementType)
      ? cloneElement(children as ReactElement<Record<string, unknown>>, {
          'aria-invalid': true,
          'aria-describedby': `${id}-error`,
        })
      : children;
  return (
    <div className={cx('flex flex-col gap-[5px]', className)}>
      <label htmlFor={id} className="text-[0.83rem] text-muted">
        {label}
      </label>
      {control}
      {error && (
        <span
          className="text-[0.8rem] text-danger"
          id={`${id}-error`}
          role="alert"
        >
          {error}
        </span>
      )}
    </div>
  );
}

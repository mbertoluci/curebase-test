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
 * Labelled field wrapper: a small secondary label above the control plus
 * accessible error wiring (aria-invalid + aria-describedby) injected when a
 * single native-ish control has an error. Compound controls wire their inputs.
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
    <div className={cx('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-[13px] font-medium text-muted">
        {label}
      </label>
      {control}
      {error && (
        <span
          className="text-[13px] text-danger"
          id={`${id}-error`}
          role="alert"
        >
          {error}
        </span>
      )}
    </div>
  );
}

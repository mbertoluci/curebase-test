import type { ComponentPropsWithoutRef } from 'react';
import { controlClass } from './Input';
import { cx } from './cx';

export function Select({
  className,
  ...props
}: ComponentPropsWithoutRef<'select'>) {
  return <select className={cx(controlClass, className)} {...props} />;
}

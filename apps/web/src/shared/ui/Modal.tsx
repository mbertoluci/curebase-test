'use client';

import { useEffect, useId, useRef } from 'react';
import type { MouseEvent, ReactNode } from 'react';
import { cx } from './cx';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  className?: string;
}

/**
 * A modal dialog built on the native <dialog> element, so the browser gives us
 * the focus trap, Escape-to-close, background inertness and top-layer stacking
 * for free (no focus-management library). React state stays the source of
 * truth: showModal/close are driven by `open`, and the native cancel (Escape)
 * and backdrop clicks are routed back through onClose instead of letting the
 * element close itself out of sync.
 */
export function Modal({ open, onClose, title, children, className }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      // Feature-detect showModal: real browsers get the true modal (focus trap,
      // top layer, backdrop); environments without it (jsdom) fall back to the
      // open attribute so the content still mounts and is testable.
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    } else if (!open && dialog.open) {
      if (typeof dialog.close === 'function') dialog.close();
      else dialog.removeAttribute('open');
    }
  }, [open]);

  // A click whose target is the dialog element itself (not its content) is a
  // click on the backdrop - close on it, the common modal affordance.
  const onBackdropClick = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target === ref.current) onClose();
  };

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={onBackdropClick}
      className={cx(
        // m-auto restores the native modal centering that Tailwind's preflight
        // margin reset would otherwise strip.
        'm-auto w-[min(720px,calc(100vw-2rem))] max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-card border border-border bg-surface p-0 text-ink shadow-toast backdrop:bg-black/40 backdrop:backdrop-blur-sm',
        className,
      )}
    >
      <div className="sticky top-0 flex items-center justify-between border-b border-border bg-surface px-5 py-3.5">
        <h2 id={titleId} className="text-[17px] font-bold tracking-tight">
          {title}
        </h2>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-full text-[18px] text-muted transition hover:bg-surface-2 hover:text-ink"
        >
          ✕
        </button>
      </div>
      <div className="p-5">{children}</div>
    </dialog>
  );
}

'use client';

import { useEffect } from 'react';
import { reportError } from '../shared/report-error';
import { Button } from '../shared/ui';

/**
 * Route-segment error boundary. A render/runtime crash lands here instead of a
 * blank page: the error is reported for observability and the user gets a way
 * back via `reset()`.
 */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportError(error, 'render-boundary');
  }, [error]);

  return (
    <main className="mx-auto flex max-w-[1040px] flex-col items-start gap-4 px-4 pt-8">
      <h1 className="text-[1.6rem] font-semibold">Something went wrong</h1>
      <p className="text-muted">
        The page hit an unexpected error. You can try again.
      </p>
      <Button variant="primary" onClick={reset}>
        Try again
      </Button>
    </main>
  );
}

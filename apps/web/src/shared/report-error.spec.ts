import { reportError } from './report-error';

// NODE_ENV is typed read-only; cast to flip it for the prod/dev branches.
const setNodeEnv = (value: string | undefined) => {
  (process.env as { NODE_ENV?: string }).NODE_ENV = value;
};

describe('reportError', () => {
  const original = process.env.NODE_ENV;
  let spy: jest.SpyInstance;

  beforeEach(() => {
    spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => {
    spy.mockRestore();
    setNodeEnv(original);
  });

  it('logs name/message/stack (but not the raw error) in development', () => {
    setNodeEnv('development');
    reportError(new Error('boom'), 'ctx');
    expect(spy).toHaveBeenCalledWith(
      '[ctx]',
      expect.objectContaining({ name: 'Error', message: 'boom' }),
    );
  });

  it('logs only the error class + context (no message/stack) in production', () => {
    setNodeEnv('production');
    reportError(new Error('secret@example.com'), 'ctx');
    expect(spy).toHaveBeenCalledWith('[ctx] Error');
    // No second argument: a message/stack that could carry PII is never logged.
    expect(spy.mock.calls[0]).toHaveLength(1);
  });

  it('handles a non-Error value', () => {
    setNodeEnv('development');
    reportError('weird', 'ctx');
    expect(spy).toHaveBeenCalledWith(
      '[ctx]',
      expect.objectContaining({ name: 'UnknownError', message: 'weird' }),
    );
  });
});

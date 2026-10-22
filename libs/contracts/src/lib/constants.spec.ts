import { ErrorCode } from './errors';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from './participant';

describe('contract constants', () => {
  it('exposes the stable error codes', () => {
    expect(ErrorCode.VALIDATION_FAILED).toBe('VALIDATION_FAILED');
    expect(ErrorCode.EMAIL_ALREADY_EXISTS).toBe('EMAIL_ALREADY_EXISTS');
    expect(ErrorCode.PARTICIPANT_NOT_FOUND).toBe('PARTICIPANT_NOT_FOUND');
  });

  it('exposes the pagination defaults', () => {
    expect(DEFAULT_PAGE_SIZE).toBe(25);
    expect(MAX_PAGE_SIZE).toBe(100);
  });
});

import { ApiError } from './http';
import { normalizeApiError } from './api-error';
import { reportError } from './report-error';

jest.mock('./report-error', () => ({ reportError: jest.fn() }));

const FIELDS = [
  'firstName',
  'lastName',
  'email',
  'phone',
  'weight',
  'height',
  'unit',
  'age',
] as const;

const normalize = (error: unknown) =>
  normalizeApiError(error, FIELDS, 'test-context');

beforeEach(() => jest.clearAllMocks());

describe('normalizeApiError', () => {
  it('routes each validation detail to its field and strips the leading token', () => {
    const result = normalize(
      new ApiError(400, 'VALIDATION_FAILED', 'Validation failed', [
        'email must be an email',
        'weight must be a positive number',
      ]),
    );
    expect(result.fieldErrors).toEqual({
      email: 'Must be an email',
      weight: 'Must be a positive number',
    });
    expect(result.formError).toBeUndefined();
    expect(result.code).toBe('VALIDATION_FAILED');
  });

  it('keeps the first message when a field has several', () => {
    const result = normalize(
      new ApiError(400, 'VALIDATION_FAILED', 'Validation failed', [
        'age must be an integer',
        'age must not be less than 0',
      ]),
    );
    expect(result.fieldErrors.age).toBe('Must be an integer');
  });

  it('sends a message for an unknown field to the form error', () => {
    const result = normalize(
      new ApiError(400, 'VALIDATION_FAILED', 'Validation failed', [
        'property limit should not exist',
        'email must be an email',
      ]),
    );
    expect(result.fieldErrors).toEqual({ email: 'Must be an email' });
    expect(result.formError).toBe('property limit should not exist');
  });

  it('matches a field case-insensitively (capitalized domain messages)', () => {
    const result = normalize(
      new ApiError(400, 'VALIDATION_FAILED', 'Validation failed', [
        'Weight 5 lb is implausible for the given height',
      ]),
    );
    expect(result.fieldErrors.weight).toBe(
      '5 lb is implausible for the given height',
    );
  });

  it('falls back to the message when validation carries no details', () => {
    const result = normalize(
      new ApiError(400, 'VALIDATION_FAILED', 'Validation failed'),
    );
    expect(result.fieldErrors).toEqual({});
    expect(result.formError).toBe('Validation failed');
  });

  it('maps a duplicate email onto the email field', () => {
    const result = normalize(
      new ApiError(409, 'EMAIL_ALREADY_EXISTS', 'already exists', {
        email: 'a@b.com',
      }),
    );
    expect(result.fieldErrors.email).toBe(
      'A participant with this email already exists',
    );
    expect(result.formError).toBeUndefined();
    expect(result.code).toBe('EMAIL_ALREADY_EXISTS');
  });

  it('gives a friendly form message for a vanished record', () => {
    const result = normalize(
      new ApiError(404, 'PARTICIPANT_NOT_FOUND', 'Participant "p1" not found'),
    );
    expect(result.formError).toMatch(/no longer exists/);
    expect(result.fieldErrors).toEqual({});
  });

  it('passes through the safe message for network and server errors', () => {
    expect(
      normalize(new ApiError(0, 'NETWORK_ERROR', 'Could not reach the server.'))
        .formError,
    ).toBe('Could not reach the server.');
    expect(
      normalize(new ApiError(500, 'INTERNAL_ERROR', 'An unexpected error'))
        .formError,
    ).toBe('An unexpected error');
  });

  it('reports a non-API error and returns the generic message', () => {
    const result = normalize(new Error('kaboom'));
    expect(result.formError).toBe('Something went wrong. Please try again.');
    expect(result.code).toBe('UNKNOWN');
    expect(reportError).toHaveBeenCalledWith(expect.any(Error), 'test-context');
  });
});

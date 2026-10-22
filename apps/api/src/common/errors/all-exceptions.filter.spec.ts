import {
  ArgumentsHost,
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ErrorCode } from '@org/contracts';
import {
  EmailAlreadyExistsError,
  ParticipantNotFoundError,
} from '../../features/participants/participants.error';
import { AllExceptionsFilter } from './all-exceptions.filter';

describe('AllExceptionsFilter', () => {
  const filter = new AllExceptionsFilter();
  let json: jest.Mock;
  let status: jest.Mock;

  function run(exception: unknown, url = '/api/participants', method = 'POST') {
    json = jest.fn();
    status = jest.fn().mockReturnValue({ json });
    const host = {
      switchToHttp: () => ({
        getResponse: () => ({ status }),
        getRequest: () => ({ url, method }),
      }),
    } as unknown as ArgumentsHost;
    filter.catch(exception, host);
    return json.mock.calls[0][0];
  }

  it('maps a domain AppException to its code + status', () => {
    const body = run(new ParticipantNotFoundError('abc'));
    expect(status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(body).toMatchObject({
      statusCode: 404,
      code: ErrorCode.PARTICIPANT_NOT_FOUND,
      path: '/api/participants',
    });
    expect(body.timestamp).toBeDefined();
  });

  it('carries AppException details (e.g. the conflicting email)', () => {
    const body = run(new EmailAlreadyExistsError('a@b.com'));
    expect(body.code).toBe(ErrorCode.EMAIL_ALREADY_EXISTS);
    expect(body.details).toEqual({ email: 'a@b.com' });
  });

  it('maps ValidationPipe BadRequest to VALIDATION_FAILED with field details', () => {
    const exception = new BadRequestException({
      message: ['email must be an email', 'age must be an integer'],
      error: 'Bad Request',
      statusCode: 400,
    });
    const body = run(exception);
    expect(body.code).toBe(ErrorCode.VALIDATION_FAILED);
    expect(body.message).toBe('Validation failed');
    expect(body.details).toEqual([
      'email must be an email',
      'age must be an integer',
    ]);
  });

  it('maps a non-validation HttpException to an HTTP_<status> code', () => {
    const body = run(new ForbiddenException('nope'));
    expect(body.statusCode).toBe(403);
    expect(body.code).toBe('HTTP_403');
    expect(body.message).toBe('nope');
  });

  it('maps a 404 HttpException code via the status map', () => {
    const body = run(new HttpException('gone', HttpStatus.NOT_FOUND));
    expect(body.code).toBe(ErrorCode.PARTICIPANT_NOT_FOUND);
  });

  it('maps a 409 HttpException code via the status map', () => {
    const body = run(
      new HttpException({ message: 'dupe' }, HttpStatus.CONFLICT),
    );
    expect(body.code).toBe(ErrorCode.EMAIL_ALREADY_EXISTS);
    expect(body.message).toBe('dupe');
  });

  it('hides unexpected errors behind a generic 500', () => {
    const body = run(new Error('secret stack detail'));
    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(body).toMatchObject({
      code: ErrorCode.INTERNAL_ERROR,
      message: 'An unexpected error occurred',
    });
    expect(JSON.stringify(body)).not.toContain('secret stack detail');
  });

  it('handles a non-Error thrown value', () => {
    const body = run('boom');
    expect(body.statusCode).toBe(500);
  });

  it('falls back to the exception message when the response object has no message', () => {
    const body = run(new HttpException({ error: 'teapot' }, 418));
    expect(body.statusCode).toBe(418);
    expect(typeof body.message).toBe('string');
    expect(body.details).toBeUndefined();
  });
});

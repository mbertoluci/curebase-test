import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ApiErrorBody, ErrorCode } from '@org/contracts';
import type { Request, Response } from 'express';
import { AppException } from './app-exception';

/**
 * Single exit point for every error. Guarantees that:
 *  - responses always use the same {@link ApiErrorBody} envelope;
 *  - a stable machine `code` is present;
 *  - stack traces and unexpected internals never reach the client (no PII leak);
 *  - 5xx are logged at error level, expected 4xx at debug.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const body = this.toErrorBody(exception, request.url);

    if (body.statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      // Log the real error server-side; the client only gets the safe envelope.
      this.logger.error(
        `${request.method} ${request.url} -> ${body.statusCode}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else {
      this.logger.debug(
        `${request.method} ${request.url} -> ${body.statusCode} (${body.code})`,
      );
    }

    response.status(body.statusCode).json(body);
  }

  private toErrorBody(exception: unknown, path: string): ApiErrorBody {
    const timestamp = new Date().toISOString();

    // 1) Our own domain errors - already carry code + status + safe message.
    if (exception instanceof AppException) {
      return {
        statusCode: exception.httpStatus,
        code: exception.code,
        message: exception.message,
        details: exception.details,
        timestamp,
        path,
      };
    }

    // 2) Nest HttpExceptions, including ValidationPipe's BadRequest.
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();
      const isValidation = status === HttpStatus.BAD_REQUEST;
      return {
        statusCode: status,
        code: isValidation
          ? ErrorCode.VALIDATION_FAILED
          : this.codeForStatus(status),
        message: this.messageFromHttpResponse(res, exception.message),
        details: this.detailsFromHttpResponse(res),
        timestamp,
        path,
      };
    }

    // 3) Anything else is a bug - hide the detail behind a generic 500.
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: ErrorCode.INTERNAL_ERROR,
      message: 'An unexpected error occurred',
      timestamp,
      path,
    };
  }

  private messageFromHttpResponse(
    res: string | object,
    fallback: string,
  ): string {
    if (typeof res === 'string') return res;
    const message = (res as { message?: unknown }).message;
    if (Array.isArray(message)) return 'Validation failed';
    if (typeof message === 'string') return message;
    return fallback;
  }

  /** For validation errors, surface the per-field messages as structured detail. */
  private detailsFromHttpResponse(res: string | object): unknown {
    if (typeof res === 'string') return undefined;
    const message = (res as { message?: unknown }).message;
    return Array.isArray(message) ? message : undefined;
  }

  private codeForStatus(status: number): string {
    if (status === HttpStatus.NOT_FOUND) return ErrorCode.PARTICIPANT_NOT_FOUND;
    if (status === HttpStatus.CONFLICT) return ErrorCode.EMAIL_ALREADY_EXISTS;
    return `HTTP_${status}`;
  }
}

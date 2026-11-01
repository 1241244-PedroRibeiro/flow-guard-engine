import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import {
  DomainError,
  DomainInvariantException,
  EntityNotFoundException,
  OptimisticConcurrencyConflictException,
  ResourceConflictException,
  UnauthorizedDomainException,
  ForbiddenDomainException,
} from '../domain/common/DomainError';

interface PgDatabaseError extends Error {
  code?: string;
  detail?: string;
  constraint?: string;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  public catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let errorName = 'Internal Server Error';
    let message = 'An unexpected internal server error occurred.';
    let details: string[] | undefined;

    // 1. Domain & Application Custom Exceptions (Clean Architecture Mapping - KB §19)
    if (exception instanceof EntityNotFoundException) {
      status = HttpStatus.NOT_FOUND;
      errorName = 'Not Found';
      message = exception.message;
    } else if (
      exception instanceof ResourceConflictException ||
      exception instanceof OptimisticConcurrencyConflictException
    ) {
      status = HttpStatus.CONFLICT;
      errorName = 'Conflict';
      message = exception.message;
      details = exception.details;
    } else if (exception instanceof DomainInvariantException) {
      status = HttpStatus.UNPROCESSABLE_ENTITY;
      errorName = 'Unprocessable Entity';
      message = exception.message;
      details = exception.details;
    } else if (exception instanceof UnauthorizedDomainException) {
      status = HttpStatus.UNAUTHORIZED;
      errorName = 'Unauthorized';
      message = exception.message;
      response.setHeader('WWW-Authenticate', 'Bearer realm="FlowGuard"');
    } else if (exception instanceof ForbiddenDomainException) {
      status = HttpStatus.FORBIDDEN;
      errorName = 'Forbidden';
      message = exception.message;
    } else if (exception instanceof DomainError) {
      status = HttpStatus.BAD_REQUEST;
      errorName = 'Bad Request';
      message = exception.message;
      details = exception.details;
    }
    // 2. Standard NestJS HttpExceptions (Guards, Boundary Validation Pipes)
    else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const resBody = exception.getResponse();

      if (typeof resBody === 'string') {
        message = resBody;
        errorName = HttpStatus[status] ?? 'Error';
      } else if (typeof resBody === 'object' && resBody !== null) {
        const bodyObj = resBody as Record<string, unknown>;
        errorName = (bodyObj.error as string) ?? HttpStatus[status] ?? 'Error';
        if (Array.isArray(bodyObj.message)) {
          message = bodyObj.message[0] ?? 'Validation failed';
          details = bodyObj.message.map(String);
        } else if (typeof bodyObj.message === 'string') {
          message = bodyObj.message;
        }
        if (Array.isArray(bodyObj.details)) {
          details = bodyObj.details.map(String);
        }
      }

      if (status === HttpStatus.UNAUTHORIZED) {
        response.setHeader('WWW-Authenticate', 'Bearer realm="FlowGuard"');
      }
    }
    // 3. Native PostgreSQL Constraint Violations (ON DELETE RESTRICT / UNIQUE / CHECK - ADR-0003)
    else if (this.isPgDatabaseError(exception)) {
      if (exception.code === '23503') {
        status = HttpStatus.CONFLICT;
        errorName = 'Conflict';
        message =
          'Cannot delete or modify record because it is actively referenced by dependent industrial assets.';
        details = exception.constraint
          ? [`Foreign key constraint ${exception.constraint} (ON DELETE RESTRICT) blocked operation.`]
          : undefined;
      } else if (exception.code === '23505') {
        status = HttpStatus.CONFLICT;
        errorName = 'Conflict';
        message = 'A record with the provided unique business code or email already exists.';
        details = exception.constraint ? [`Unique constraint violated: ${exception.constraint}`] : undefined;
      } else if (exception.code === '23514') {
        status = HttpStatus.UNPROCESSABLE_ENTITY;
        errorName = 'Unprocessable Entity';
        message = 'Database domain invariant check constraint violated.';
        details = exception.constraint ? [`Check constraint violated: ${exception.constraint}`] : undefined;
      } else if (process.env.NODE_ENV !== 'test') {
        console.error('[FlowGuard Unhandled DB Error]:', exception);
      }
    } else if (process.env.NODE_ENV !== 'test') {
      console.error('[FlowGuard Unhandled Exception]:', exception);
    }

    response.status(status).json({
      timestamp: new Date().toISOString(),
      status,
      error: errorName,
      message,
      path: request.originalUrl ?? request.url,
      ...(details && details.length > 0 ? { details } : {}),
    });
  }

  private isPgDatabaseError(err: unknown): err is PgDatabaseError {
    return typeof err === 'object' && err !== null && 'code' in err && typeof (err as PgDatabaseError).code === 'string';
  }
}
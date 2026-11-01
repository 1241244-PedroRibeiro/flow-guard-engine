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
} from '../domain/common/exceptions';

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
    
    // Type cast seguro para contornar o erro TS18046 no strict mode
    // após validarmos o tipo com instanceof
    const err = exception as any;

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let errorName = 'Internal Server Error';
    let message = 'An unexpected internal server error occurred.';
    let details: string[] | undefined;

    // 1. Domain & Application Custom Exceptions
    if (err instanceof EntityNotFoundException) {
      status = HttpStatus.NOT_FOUND;
      errorName = 'Not Found';
      message = err.message;
    } else if (
      err instanceof ResourceConflictException ||
      err instanceof OptimisticConcurrencyConflictException
    ) {
      status = HttpStatus.CONFLICT;
      errorName = 'Conflict';
      message = err.message;
      details = err.details;
    } else if (err instanceof DomainInvariantException) {
      status = HttpStatus.UNPROCESSABLE_ENTITY;
      errorName = 'Unprocessable Entity';
      message = err.message;
      details = err.details;
    } else if (err instanceof UnauthorizedDomainException) {
      status = HttpStatus.UNAUTHORIZED;
      errorName = 'Unauthorized';
      message = err.message;
      response.setHeader('WWW-Authenticate', 'Bearer realm="FlowGuard"');
    } else if (err instanceof ForbiddenDomainException) {
      status = HttpStatus.FORBIDDEN;
      errorName = 'Forbidden';
      message = err.message;
    } else if (err instanceof DomainError) {
      status = HttpStatus.BAD_REQUEST;
      errorName = 'Bad Request';
      message = err.message;
      details = err.details;
    }
    // 2. Standard NestJS HttpExceptions
    else if (err instanceof HttpException) {
      status = err.getStatus();
      const resBody = err.getResponse();

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
    // 3. Native PostgreSQL Constraint Violations
    else if (this.isPgDatabaseError(err)) {
      if (err.code === '23503') {
        status = HttpStatus.CONFLICT;
        errorName = 'Conflict';
        message =
          'Cannot delete or modify record because it is actively referenced by dependent industrial assets.';
        details = err.constraint
          ? [`Foreign key constraint ${err.constraint} (ON DELETE RESTRICT) blocked operation.`]
          : undefined;
      } else if (err.code === '23505') {
        status = HttpStatus.CONFLICT;
        errorName = 'Conflict';
        message = 'A record with the provided unique business code or email already exists.';
        details = err.constraint ? [`Unique constraint violated: ${err.constraint}`] : undefined;
      } else if (err.code === '23514') {
        status = HttpStatus.UNPROCESSABLE_ENTITY;
        errorName = 'Unprocessable Entity';
        message = 'Database domain invariant check constraint violated.';
        details = err.constraint ? [`Check constraint violated: ${err.constraint}`] : undefined;
      } else if (process.env.NODE_ENV !== 'test') {
        console.error('[FlowGuard Unhandled DB Error]:', err);
      }
    } else if (process.env.NODE_ENV !== 'test') {
      console.error('[FlowGuard Unhandled Exception]:', err);
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
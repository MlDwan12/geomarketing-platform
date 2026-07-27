import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import { codeFromStatus } from '../common/error-codes';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (response.headersSent) return;

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = 'Внутренняя ошибка сервера';
    let details: string[] | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      code = codeFromStatus(status);

      const body = exception.getResponse();

      if (typeof body === 'string') {
        message = body;
      } else if (typeof body === 'object' && body !== null) {
        const { message: msg } = body as Record<string, unknown>;

        if (Array.isArray(msg)) {
          details = msg as string[];
          message = 'Ошибка валидации';
        } else if (typeof msg === 'string') {
          message = msg;
        }
      }
    } else if (
      typeof exception === 'object' &&
      exception !== null &&
      ('status' in exception || 'statusCode' in exception)
    ) {
      // Plain RPC error object from core-service: { status, message }
      const e = exception as Record<string, unknown>;
      const rawStatus = (e['status'] ?? e['statusCode']) as number;
      if (
        typeof rawStatus === 'number' &&
        rawStatus >= 400 &&
        rawStatus < 600
      ) {
        status = rawStatus;
        message = (e['message'] as string) ?? message;
        code = codeFromStatus(status);
      }
    }

    response.status(status).json({
      success: false,
      error: {
        code,
        message,
        ...(details ? { details } : {}),
      },
    });
  }
}

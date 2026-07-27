import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { Response } from 'express';
import { codeFromStatus } from '../common/error-codes';

@Catch(RpcException)
export class RpcExceptionFilter implements ExceptionFilter {
  catch(exception: RpcException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const err = exception.getError();

    let status = 500;
    let code = 'INTERNAL_ERROR';
    let message = 'Внутренняя ошибка сервера';

    if (typeof err === 'object' && err !== null) {
      const e = err as Record<string, unknown>;
      status = (e['statusCode'] ?? e['status'] ?? 500) as number;
      message = (e['message'] ?? message) as string;
      code = (e['code'] as string) ?? codeFromStatus(status);
    }

    return res.status(status).json({
      success: false,
      error: { code, message },
    });
  }
}

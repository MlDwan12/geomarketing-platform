import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { Response } from 'express';

@Catch(RpcException)
export class RpcExceptionFilter implements ExceptionFilter {
  catch(exception: RpcException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const err = exception.getError();

    if (typeof err === 'object' && err !== null && 'statusCode' in err) {
      const { statusCode, message } = err as { statusCode: number; message: string };
      return res.status(statusCode).json({ message });
    }

    return res.status(500).json({ message: String(err) });
  }
}

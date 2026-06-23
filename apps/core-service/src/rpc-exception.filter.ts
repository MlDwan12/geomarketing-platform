import { ArgumentsHost, Catch, ExceptionFilter, Logger } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { throwError } from 'rxjs';

@Catch()
export class RpcExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('RpcException');

  catch(exception: unknown, host: ArgumentsHost) {
    if (exception instanceof RpcException) {
      return throwError(() => exception.getError());
    }

    this.logger.error(
      exception instanceof Error ? exception.stack : String(exception),
    );

    return throwError(() => ({
      status: 500,
      message: exception instanceof Error ? exception.message : 'Internal error',
    }));
  }
}

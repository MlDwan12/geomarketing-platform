import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { throwError } from 'rxjs';
import { LoggerService } from '@geo/logger';

@Catch()
export class RpcExceptionFilter implements ExceptionFilter {
  private readonly logger = new LoggerService();

  catch(exception: unknown, host: ArgumentsHost) {
    if (exception instanceof RpcException) {
      return throwError(() => exception.getError());
    }

    // Error передаётся как message целиком (не exception.stack строкой) —
    // LoggerService сам раскладывает message/stack по отдельным полям JSON
    // (см. libs/logger). correlationId подмешивается автоматически, если
    // RequestContext активен (CorrelationIdInterceptor).
    this.logger.error(
      exception instanceof Error ? exception : String(exception),
      'RpcException',
    );

    return throwError(() => ({
      status: 500,
      message: exception instanceof Error ? exception.message : 'Internal error',
    }));
  }
}

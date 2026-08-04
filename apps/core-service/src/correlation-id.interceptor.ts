import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { RmqContext } from '@nestjs/microservices';
import { randomUUID } from 'crypto';
import { Observable } from 'rxjs';
import { CORRELATION_ID_HEADER, RequestContext } from '@geo/logger';

/**
 * Читает correlation-id из AMQP-заголовка входящего RMQ-сообщения
 * (проставлен api-gateway через sendRpc/RmqRecordBuilder) и держит его в
 * RequestContext (AsyncLocalStorage) на время обработки — так LoggerService
 * подмешивает его во все логи этого RPC-вызова без ручной передачи.
 *
 * Если заголовка нет (сообщение не от api-gateway — например, будущий вызов
 * от другого сервиса, или локальный smoke-запрос) — генерирует новый id и
 * не падает.
 *
 * next.handle() — ленивый Observable; чтобы гарантированно выполнить
 * обработчик (и всё, что он await'ит) внутри AsyncLocalStorage-контекста,
 * подписываемся на него вручную ВНУТРИ RequestContext.run(), а не просто
 * вызываем next.handle() там же.
 */
// getMessage() типизирован как Record<string, any> в @nestjs/microservices —
// приводим через unknown к конкретной форме, чтобы не тянуть unsafe-member-access.
interface RawAmqpMessage {
  properties?: { headers?: Record<string, unknown> };
}

@Injectable()
export class CorrelationIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const rmqContext = context.switchToRpc().getContext<RmqContext>();
    const message = rmqContext.getMessage() as unknown as RawAmqpMessage;
    const headerValue = message.properties?.headers?.[CORRELATION_ID_HEADER];
    const correlationId =
      typeof headerValue === 'string' && headerValue
        ? headerValue
        : randomUUID();

    return new Observable((subscriber) => {
      RequestContext.run(correlationId, () => {
        next.handle().subscribe({
          next: (value) => subscriber.next(value),
          error: (err: unknown) => subscriber.error(err),
          complete: () => subscriber.complete(),
        });
      });
    });
  }
}

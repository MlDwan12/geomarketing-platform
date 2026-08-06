import { ClientProxy, RmqRecordBuilder } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';
import { CORRELATION_ID_HEADER, RequestContext } from '@geo/logger';

// Таймаут по умолчанию для RPC-запросов к сервисам через RabbitMQ.
export const DEFAULT_RPC_TIMEOUT = 5000;

// REL-001: таймаут переопределяем через RPC_TIMEOUT_MS (env), не меняя код.
// Читаем process.env лениво (внутри функции, а не в константе модуля) —
// на момент импорта этого файла ConfigModule.forRoot() ещё не успевает
// загрузить .env через dotenv, значение было бы всегда undefined.
function resolveDefaultTimeout(): number {
  const fromEnv = Number(process.env.RPC_TIMEOUT_MS);
  return Number.isFinite(fromEnv) && fromEnv > 0
    ? fromEnv
    : DEFAULT_RPC_TIMEOUT;
}

/**
 * Отправляет RPC-команду и ждёт единственный ответ с таймаутом.
 *
 * Убирает повтор `firstValueFrom(client.send(...).pipe(timeout(...)))` из
 * контроллеров (ARCH-002). Тип результата по умолчанию `any` — намеренно
 * сохраняет текущую типизацию `ClientProxy.send<any>`, чтобы поведение и
 * типы вызывающего кода не изменились.
 *
 * Если сейчас есть активный correlation-id (RequestContext, см. libs/logger),
 * payload оборачивается в RmqRecord с AMQP-заголовком x-correlation-id — так
 * получатель (core-service) сможет связать свои логи с этим же запросом.
 * Не штатное AMQP-свойство `correlationId` — оно занято самим
 * @nestjs/microservices для сопоставления request/reply. Без активного
 * контекста payload уходит как раньше, без обёртки.
 */
export function sendRpc<T = any>(
  client: ClientProxy,
  pattern: string,
  payload: unknown,
  timeoutMs: number = resolveDefaultTimeout(),
): Promise<T> {
  const correlationId = RequestContext.getCorrelationId();
  const message: unknown = correlationId
    ? new RmqRecordBuilder(payload)
        .setOptions({
          headers: { [CORRELATION_ID_HEADER]: correlationId },
        })
        .build()
    : payload;

  return firstValueFrom(
    client.send<T>(pattern, message).pipe(timeout(timeoutMs)),
  );
}

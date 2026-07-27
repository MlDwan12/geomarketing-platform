import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';

// Таймаут по умолчанию для RPC-запросов к сервисам через RabbitMQ.
export const DEFAULT_RPC_TIMEOUT = 5000;

/**
 * Отправляет RPC-команду и ждёт единственный ответ с таймаутом.
 *
 * Убирает повтор `firstValueFrom(client.send(...).pipe(timeout(...)))` из
 * контроллеров (ARCH-002). Тип результата по умолчанию `any` — намеренно
 * сохраняет текущую типизацию `ClientProxy.send<any>`, чтобы поведение и
 * типы вызывающего кода не изменились.
 */
export function sendRpc<T = any>(
  client: ClientProxy,
  pattern: string,
  payload: unknown,
  timeoutMs: number = DEFAULT_RPC_TIMEOUT,
): Promise<T> {
  return firstValueFrom(
    client.send<T>(pattern, payload).pipe(timeout(timeoutMs)),
  );
}

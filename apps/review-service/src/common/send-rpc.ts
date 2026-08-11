import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';

// Упрощённая версия apps/api-gateway/src/common/rpc.ts — без обёртки
// correlation-id через RmqRecordBuilder: та полагается на CorrelationIdInterceptor,
// который review-service не регистрирует (см. коммит 2 плана — этот паттерн
// специфичен для core-service, не общий для всех RMQ-сервисов проекта).
// review-service — первый в проекте backend-микросервис, вызывающий другой
// backend-микросервис по RMQ напрямую (не только api-gateway → *), поэтому
// не наследует существующий общий хелпер.
export const DEFAULT_RPC_TIMEOUT = 5000;

export function sendRpc<T = unknown>(
  client: ClientProxy,
  pattern: string,
  payload: unknown,
  timeoutMs: number = DEFAULT_RPC_TIMEOUT,
): Promise<T> {
  return firstValueFrom(
    client.send<T>(pattern, payload).pipe(timeout(timeoutMs)),
  );
}

import { AsyncLocalStorage } from 'node:async_hooks';

interface Store {
  correlationId: string;
}

const storage = new AsyncLocalStorage<Store>();

// Держит correlation-id на время обработки запроса (HTTP или RMQ-сообщения),
// чтобы не прокидывать его вручную через каждый слой — LoggerService читает
// его отсюда сам (см. logger.service.ts).
export class RequestContext {
  static run<T>(correlationId: string, fn: () => T): T {
    return storage.run({ correlationId }, fn);
  }

  static getCorrelationId(): string | undefined {
    return storage.getStore()?.correlationId;
  }
}

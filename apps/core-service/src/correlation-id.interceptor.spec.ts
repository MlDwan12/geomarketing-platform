import { CallHandler, ExecutionContext } from '@nestjs/common';
import { firstValueFrom, Observable } from 'rxjs';
import { RequestContext } from '@geo/logger';
import { CorrelationIdInterceptor } from './correlation-id.interceptor';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function fakeContext(
  headers: Record<string, unknown> | undefined,
): ExecutionContext {
  const rmqContext = {
    getMessage: () => ({ properties: { headers } }),
  };
  return {
    switchToRpc: () => ({ getContext: () => rmqContext }),
  } as unknown as ExecutionContext;
}

// "Обработчик", который сообщает наружу, каким видел correlationId изнутри
// RequestContext — так тест проверяет, что контекст реально активен во
// время выполнения handle(), а не только вокруг него.
function handlerReportingCorrelationId(): CallHandler {
  return {
    handle: () =>
      new Observable((subscriber) => {
        subscriber.next(RequestContext.getCorrelationId());
        subscriber.complete();
      }),
  };
}

describe('CorrelationIdInterceptor', () => {
  it('заголовок x-correlation-id есть → обработчик видит именно его через RequestContext', async () => {
    const interceptor = new CorrelationIdInterceptor();
    const context = fakeContext({ 'x-correlation-id': 'from-gateway-1' });

    const result = await firstValueFrom(
      interceptor.intercept(context, handlerReportingCorrelationId()),
    );

    expect(result).toBe('from-gateway-1');
  });

  it('заголовка нет (сообщение не от api-gateway) → генерирует новый id, не падает', async () => {
    const interceptor = new CorrelationIdInterceptor();
    const context = fakeContext(undefined);

    const result = await firstValueFrom(
      interceptor.intercept(context, handlerReportingCorrelationId()),
    );

    expect(result).toMatch(UUID_RE);
  });

  it('вне обработчика (после интерсептора) correlationId снова не задан', async () => {
    const interceptor = new CorrelationIdInterceptor();
    const context = fakeContext({ 'x-correlation-id': 'from-gateway-2' });

    await firstValueFrom(
      interceptor.intercept(context, handlerReportingCorrelationId()),
    );

    expect(RequestContext.getCorrelationId()).toBeUndefined();
  });

  it('ошибка из обработчика долетает до подписчика (не проглатывается)', async () => {
    const interceptor = new CorrelationIdInterceptor();
    const context = fakeContext({ 'x-correlation-id': 'from-gateway-3' });
    const failingHandler: CallHandler = {
      handle: () =>
        new Observable((subscriber) => {
          subscriber.error(new Error('boom'));
        }),
    };

    await expect(
      firstValueFrom(interceptor.intercept(context, failingHandler)),
    ).rejects.toThrow('boom');
  });
});

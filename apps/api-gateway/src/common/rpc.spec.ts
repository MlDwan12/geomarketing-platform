import { of } from 'rxjs';
import { ClientProxy, RmqRecord } from '@nestjs/microservices';
import { CORRELATION_ID_HEADER, RequestContext } from '@geo/logger';
import { DEFAULT_RPC_TIMEOUT, sendRpc } from './rpc';

function fakeClient(result: unknown = { ok: true }) {
  return { send: jest.fn().mockReturnValue(of(result)) };
}

// Тестовый клиент не реализует весь ClientProxy — приводим через unknown,
// чтобы не тянуть no-unsafe-argument от `any`.
function asClient(client: ReturnType<typeof fakeClient>): ClientProxy {
  return client as unknown as ClientProxy;
}

describe('sendRpc — correlation-id propagation', () => {
  it('без активного RequestContext — payload уходит как есть, без обёртки', async () => {
    const client = fakeClient();
    const payload = { foo: 'bar' };

    await sendRpc(asClient(client), 'some.pattern', payload);

    expect(client.send).toHaveBeenCalledWith('some.pattern', payload);
  });

  it('внутри RequestContext.run() — payload оборачивается в RmqRecord с заголовком x-correlation-id', async () => {
    const client = fakeClient();
    const payload = { foo: 'bar' };

    await RequestContext.run('req-42', () =>
      sendRpc(asClient(client), 'some.pattern', payload),
    );

    expect(client.send).toHaveBeenCalledTimes(1);
    const [pattern, message] = client.send.mock.calls[0] as [string, RmqRecord];
    expect(pattern).toBe('some.pattern');
    expect(message).toBeInstanceOf(RmqRecord);
    expect(message.data).toEqual(payload);
    expect(message.options?.headers?.[CORRELATION_ID_HEADER]).toBe('req-42');
  });

  it('результат RPC-вызова по-прежнему возвращается вызывающему коду', async () => {
    const client = fakeClient({ id: '1' });

    const result = await RequestContext.run('req-1', () =>
      sendRpc<{ id: string }>(asClient(client), 'some.pattern', {}),
    );

    expect(result).toEqual({ id: '1' });
  });

  it('таймаут по умолчанию (DEFAULT_RPC_TIMEOUT) не меняется этим коммитом', () => {
    expect(DEFAULT_RPC_TIMEOUT).toBe(5000);
  });
});

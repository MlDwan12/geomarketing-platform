import { RpcException } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { RequestContext } from '@geo/logger';
import { RpcExceptionFilter } from './rpc-exception.filter';

function lastStderrRecord(
  spy: jest.SpiedFunction<typeof process.stderr.write>,
): Record<string, unknown> {
  const calls = spy.mock.calls;
  const line = calls[calls.length - 1][0] as string;
  return JSON.parse(line.trimEnd()) as Record<string, unknown>;
}

describe('RpcExceptionFilter', () => {
  let stderr: jest.SpiedFunction<typeof process.stderr.write>;

  beforeEach(() => {
    stderr = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    stderr.mockRestore();
  });

  it('RpcException — пробрасывается как есть, без логирования', async () => {
    const filter = new RpcExceptionFilter();
    const original = { status: 404, message: 'Company not found' };

    await expect(
      firstValueFrom(filter.catch(new RpcException(original), {} as never)),
    ).rejects.toEqual(original);
    expect(stderr).not.toHaveBeenCalled();
  });

  it('обычная ошибка (Error) — логируется структурно и превращается в {status:500}', async () => {
    const filter = new RpcExceptionFilter();
    const err = new Error('unexpected boom');

    await expect(
      firstValueFrom(filter.catch(err, {} as never)),
    ).rejects.toEqual({ status: 500, message: 'unexpected boom' });

    const record = lastStderrRecord(stderr);
    expect(record['level']).toBe('error');
    expect(record['context']).toBe('RpcException');
    expect(record['message']).toBe('unexpected boom');
    expect(record['stack']).toBe(err.stack);
  });

  it('не-Error значение (например строка) — логируется, message = "Internal error"', async () => {
    const filter = new RpcExceptionFilter();

    await expect(
      firstValueFrom(filter.catch('raw string failure', {} as never)),
    ).rejects.toEqual({ status: 500, message: 'Internal error' });

    const record = lastStderrRecord(stderr);
    expect(record['message']).toBe('raw string failure');
  });

  it('при активном RequestContext — correlationId попадает в запись лога', async () => {
    const filter = new RpcExceptionFilter();

    await RequestContext.run('req-err-1', async () => {
      await expect(
        firstValueFrom(filter.catch(new Error('x'), {} as never)),
      ).rejects.toBeDefined();
    });

    const record = lastStderrRecord(stderr);
    expect(record['correlationId']).toBe('req-err-1');
  });
});

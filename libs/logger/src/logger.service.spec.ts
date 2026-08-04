import { LoggerService } from './logger.service';
import { RequestContext } from './request-context';

function lastWrite(
  spy: jest.SpiedFunction<typeof process.stdout.write>,
): Record<string, unknown> {
  const calls = spy.mock.calls;
  const line = calls[calls.length - 1][0] as string;
  return JSON.parse(line.trimEnd()) as Record<string, unknown>;
}

describe('LoggerService (structured JSON output)', () => {
  let stdout: jest.SpiedFunction<typeof process.stdout.write>;
  let stderr: jest.SpiedFunction<typeof process.stderr.write>;

  beforeEach(() => {
    stdout = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    stderr = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    stdout.mockRestore();
    stderr.mockRestore();
  });

  it('log(message) → stdout, level=log, без context', () => {
    const logger = new LoggerService();
    logger.log('started');

    expect(stdout).toHaveBeenCalledTimes(1);
    expect(stderr).not.toHaveBeenCalled();
    const record = lastWrite(stdout);
    expect(record['level']).toBe('log');
    expect(record['message']).toBe('started');
    expect(record['context']).toBeUndefined();
    expect(typeof record['timestamp']).toBe('string');
  });

  it('log(message, context) → строковый последний параметр становится context', () => {
    const logger = new LoggerService();
    logger.log('started', 'Bootstrap');

    const record = lastWrite(stdout);
    expect(record['context']).toBe('Bootstrap');
    expect(record['message']).toBe('started');
  });

  it('log(message, meta-object) → поля объекта подмешиваются на верхний уровень записи', () => {
    const logger = new LoggerService();
    logger.log('user created', { userId: '123' });

    const record = lastWrite(stdout);
    expect(record['userId']).toBe('123');
    expect(record['message']).toBe('user created');
  });

  it('log(message, meta-object, context) — оба варианта одновременно', () => {
    const logger = new LoggerService();
    logger.log('user created', { userId: '123' }, 'UserService');

    const record = lastWrite(stdout);
    expect(record['userId']).toBe('123');
    expect(record['context']).toBe('UserService');
  });

  it('error(Error) → stderr, message из Error, stack присутствует', () => {
    const logger = new LoggerService();
    const err = new Error('boom');
    logger.error(err);

    expect(stderr).toHaveBeenCalledTimes(1);
    expect(stdout).not.toHaveBeenCalled();
    const record = lastWrite(stderr);
    expect(record['level']).toBe('error');
    expect(record['message']).toBe('boom');
    expect(record['stack']).toBe(err.stack);
  });

  it('error(message, trace, context) — соглашение Nest (3 аргумента)', () => {
    const logger = new LoggerService();
    logger.error('failed', 'at foo.ts:10', 'RpcException');

    const record = lastWrite(stderr);
    expect(record['message']).toBe('failed');
    expect(record['trace']).toBe('at foo.ts:10');
    expect(record['context']).toBe('RpcException');
  });

  it('без активного RequestContext — correlationId отсутствует в записи', () => {
    const logger = new LoggerService();
    logger.log('started');

    const record = lastWrite(stdout);
    expect(record['correlationId']).toBeUndefined();
  });

  it('внутри RequestContext.run() — correlationId подмешивается в запись', () => {
    const logger = new LoggerService();
    RequestContext.run('req-1', () => logger.log('started'));

    const record = lastWrite(stdout);
    expect(record['correlationId']).toBe('req-1');
  });

  it.each(['warn', 'debug', 'verbose'] as const)(
    '%s(message) → stdout, соответствующий level',
    (level) => {
      const logger = new LoggerService();
      logger[level]('hello');

      const record = lastWrite(stdout);
      expect(record['level']).toBe(level);
    },
  );
});

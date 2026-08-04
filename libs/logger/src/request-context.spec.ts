import { RequestContext } from './request-context';

describe('RequestContext', () => {
  it('без активного run() — correlationId не задан', () => {
    expect(RequestContext.getCorrelationId()).toBeUndefined();
  });

  it('внутри run() — correlationId присутствует и совпадает', () => {
    RequestContext.run('abc-123', () => {
      expect(RequestContext.getCorrelationId()).toBe('abc-123');
    });
  });

  it('после завершения run() — correlationId снова не задан', () => {
    RequestContext.run('abc-123', () => {});
    expect(RequestContext.getCorrelationId()).toBeUndefined();
  });

  it('вложенный run() временно перекрывает внешний id, снаружи виден исходный', () => {
    RequestContext.run('outer', () => {
      RequestContext.run('inner', () => {
        expect(RequestContext.getCorrelationId()).toBe('inner');
      });
      expect(RequestContext.getCorrelationId()).toBe('outer');
    });
  });

  it('run() возвращает результат переданной функции', () => {
    const result = RequestContext.run('id', () => 42);
    expect(result).toBe(42);
  });

  it('correlationId сохраняется через await внутри run()', async () => {
    await RequestContext.run('async-id', async () => {
      await Promise.resolve();
      expect(RequestContext.getCorrelationId()).toBe('async-id');
    });
  });
});

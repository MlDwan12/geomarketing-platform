/**
 * Characterization-тесты (Этап 0).
 *
 * Фиксируют публичный контракт формата ответа { success: true, data } и
 * преобразование дат по X-Timezone. Затрагивает ARCH-004 (логгер/обвязка) и
 * любые будущие правки интерцептора — форма ответа и формат дат меняться не должны.
 */
import { firstValueFrom, of } from 'rxjs';
import { ResponseInterceptor } from './response.interceptor';

function mockCtx(headers: Record<string, string>) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ headers }),
    }),
  } as never;
}

function run(data: unknown, headers: Record<string, string> = {}) {
  const interceptor = new ResponseInterceptor();
  const next = { handle: () => of(data) };
  return firstValueFrom(interceptor.intercept(mockCtx(headers), next as never));
}

describe('ResponseInterceptor (characterization)', () => {
  it('оборачивает в { success: true, data }', async () => {
    const out = await run({ id: '1', name: 'x' });
    expect(out).toEqual({ success: true, data: { id: '1', name: 'x' } });
  });

  it('примитив/массив тоже оборачиваются', async () => {
    expect(await run(null)).toEqual({ success: true, data: null });
    expect(await run([1, 2])).toEqual({ success: true, data: [1, 2] });
  });

  it('Date-поле форматируется в ISO со смещением (UTC → +00:00)', async () => {
    const out = (await run(
      { createdAt: new Date('2026-01-15T10:00:00.000Z') },
      { 'x-timezone': 'UTC' },
    )) as { data: { createdAt: string } };
    expect(out.data.createdAt).toBe('2026-01-15T10:00:00.000+00:00');
  });

  it('строка в ISO-формате тоже конвертируется', async () => {
    const out = (await run(
      { at: '2026-01-15T10:00:00.000Z' },
      { 'x-timezone': 'UTC' },
    )) as { data: { at: string } };
    expect(out.data.at).toBe('2026-01-15T10:00:00.000+00:00');
  });

  it('обычные строки не трогаются', async () => {
    const out = (await run(
      { name: 'просто текст' },
      { 'x-timezone': 'UTC' },
    )) as {
      data: { name: string };
    };
    expect(out.data.name).toBe('просто текст');
  });
});

/**
 * Characterization-тесты (Этап 0).
 *
 * Фиксируют текущий формат ответов об ошибках (публичный контракт):
 *   { success: false, error: { code, message, details? } }
 * Затрагивают ARCH-005 (дубль STATUS_TO_CODE) — при будущем объединении карт
 * коды/тела должны остаться идентичными.
 */
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { HttpExceptionFilter } from './http-exception.filter';
import { RpcExceptionFilter } from './rpc-exception.filter';

type Captured = { status?: number; body?: unknown };

function mockHost(captured: Captured, headersSent = false) {
  const res = {
    headersSent,
    status(code: number) {
      captured.status = code;
      return res;
    },
    json(body: unknown) {
      captured.body = body;
      return res;
    },
  };
  return {
    switchToHttp: () => ({
      getResponse: () => res,
      getRequest: () => ({}),
    }),
  } as never;
}

describe('HttpExceptionFilter (characterization)', () => {
  it('HttpException со строковым message', () => {
    const c: Captured = {};
    new HttpExceptionFilter().catch(
      new ForbiddenException('нет доступа'),
      mockHost(c),
    );
    expect(c.status).toBe(403);
    expect(c.body).toEqual({
      success: false,
      error: { code: 'FORBIDDEN', message: 'нет доступа' },
    });
  });

  it('ошибка валидации (message-массив) → details + общий текст', () => {
    const c: Captured = {};
    new HttpExceptionFilter().catch(
      new BadRequestException({
        message: ['e1', 'e2'],
        error: 'Bad Request',
        statusCode: 400,
      }),
      mockHost(c),
    );
    expect(c.status).toBe(400);
    expect(c.body).toEqual({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Ошибка валидации',
        details: ['e1', 'e2'],
      },
    });
  });

  it('plain RPC-объект { status, message }', () => {
    const c: Captured = {};
    new HttpExceptionFilter().catch(
      { status: 404, message: 'Company not found' },
      mockHost(c),
    );
    expect(c.status).toBe(404);
    expect(c.body).toEqual({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Company not found' },
    });
  });

  it('неизвестная ошибка → 500 INTERNAL_ERROR', () => {
    const c: Captured = {};
    new HttpExceptionFilter().catch(new Error('boom'), mockHost(c));
    expect(c.status).toBe(500);
    expect(c.body).toEqual({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Внутренняя ошибка сервера' },
    });
  });

  it('headersSent → ничего не пишет', () => {
    const c: Captured = {};
    new HttpExceptionFilter().catch(
      new ForbiddenException('x'),
      mockHost(c, true),
    );
    expect(c.status).toBeUndefined();
    expect(c.body).toBeUndefined();
  });
});

describe('RpcExceptionFilter (characterization)', () => {
  it('RpcException { status, message } → маппинг кода', () => {
    const c: Captured = {};
    new RpcExceptionFilter().catch(
      new RpcException({ status: 404, message: 'Not found' }),
      mockHost(c),
    );
    expect(c.status).toBe(404);
    expect(c.body).toEqual({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Not found' },
    });
  });

  it('RpcException без деталей → 500 INTERNAL_ERROR', () => {
    const c: Captured = {};
    new RpcExceptionFilter().catch(new RpcException({}), mockHost(c));
    expect(c.status).toBe(500);
    expect(c.body).toEqual({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Внутренняя ошибка сервера' },
    });
  });
});

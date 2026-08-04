import { resolveCorrelationId } from './correlation-id';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe('resolveCorrelationId', () => {
  it('заголовка нет → генерирует новый UUID', () => {
    const id = resolveCorrelationId(undefined);
    expect(id).toMatch(UUID_RE);
  });

  it('заголовок пустой → генерирует новый UUID (не переиспользует пустую строку)', () => {
    const id = resolveCorrelationId('');
    expect(id).toMatch(UUID_RE);
  });

  it('заголовок непустой (string) → переиспользует значение клиента как есть', () => {
    expect(resolveCorrelationId('client-req-1')).toBe('client-req-1');
  });

  it('заголовок с пробелами по краям → тримится', () => {
    expect(resolveCorrelationId('  client-req-1  ')).toBe('client-req-1');
  });

  it('заголовок пришёл массивом (повтор заголовка) → берётся первое непустое значение', () => {
    expect(resolveCorrelationId(['first-id', 'second-id'])).toBe('first-id');
  });

  it('заголовок — пустой массив → генерирует новый UUID', () => {
    const id = resolveCorrelationId([]);
    expect(id).toMatch(UUID_RE);
  });

  it('два вызова без заголовка дают разные id (не константа)', () => {
    expect(resolveCorrelationId(undefined)).not.toBe(
      resolveCorrelationId(undefined),
    );
  });
});

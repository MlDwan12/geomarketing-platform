import { randomUUID } from 'crypto';

export const CORRELATION_ID_HEADER = 'x-correlation-id';

// Переиспользует correlation-id клиента, если он есть (непустая строка),
// иначе генерирует новый. Express может отдать значение заголовка как
// string[] при повторении заголовка — берём первое непустое.
export function resolveCorrelationId(
  headerValue: string | string[] | undefined,
): string {
  const raw = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  const trimmed = raw?.trim();
  return trimmed ? trimmed : randomUUID();
}

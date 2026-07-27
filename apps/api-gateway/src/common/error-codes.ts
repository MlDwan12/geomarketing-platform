// Единый маппинг HTTP-статус → машиночитаемый код ошибки.
// Используется обоими фильтрами (HttpExceptionFilter, RpcExceptionFilter),
// чтобы формат тела ошибки { code, message } был согласован.
export const STATUS_TO_CODE: Record<number, string> = {
  400: 'VALIDATION_ERROR',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  422: 'UNPROCESSABLE_ENTITY',
};

export function codeFromStatus(status: number): string {
  return STATUS_TO_CODE[status] ?? 'INTERNAL_ERROR';
}

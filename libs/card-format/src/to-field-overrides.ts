// Оборачивает плоские значения полей карточки в форму, ожидаемую
// CompanyDefault.fieldOverrides (Record<field, { value }>, см.
// company-default.entity.ts в core-service) — не специфично для провайдера.
export function toFieldOverrides(
  fields: Record<string, unknown>,
): Record<string, { value: unknown }> {
  const overrides: Record<string, { value: unknown }> = {};
  for (const [key, value] of Object.entries(fields)) {
    overrides[key] = { value };
  }
  return overrides;
}

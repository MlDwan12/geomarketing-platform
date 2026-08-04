import {
  CompanyDefault,
  FieldOverride,
  FieldOverrides,
} from './company-default.entity';
import { CompanyTemplate } from './company-template.entity';

// Мультиязычные поля мержатся по языку (а не заменяются целиком) при platform-override.
export const LANG_MERGE_FIELDS = new Set([
  'names',
  'shortNames',
  'altNames',
  'descriptions',
  'shortDescriptions',
]);

export type LangItem = { lang: string; val: string };

// Единое правило приоритета (ARCH-003): true, если хранимое значение override
// должно перебить значение шаблона для базового (не platform-specific) значения.
// Override побеждает, если у него задано value и isException не выставлен явно
// в false. isException:undefined ТОЖЕ считается победой override — override
// пишется только когда пользователь явно задал значение (см. company-default.entity.ts),
// поэтому отсутствие isException не должно трактоваться как «используй шаблон».
function overrideHasPriority(override: FieldOverride | undefined): boolean {
  return override?.value !== undefined && override?.isException !== false;
}

// Итоговые плоские значения полей для конкретной платформы.
// Приоритет: platform override → company value → template value.
export function resolveForPlatform(
  platformKey: string,
  templateFields: Record<string, unknown>,
  overrides: FieldOverrides,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const allKeys = new Set([
    ...Object.keys(templateFields),
    ...Object.keys(overrides),
  ]);

  for (const key of allKeys) {
    const override = overrides[key] as FieldOverride | undefined;
    const templateValue = templateFields[key];

    // Base value priority: company value (no template) → exception override → template
    let baseValue: unknown;
    if (overrideHasPriority(override)) {
      baseValue = override!.value;
    } else if (templateValue !== undefined) {
      baseValue = templateValue;
    }

    const platformOverride = override?.platforms?.[platformKey];

    if (platformOverride !== undefined) {
      // Multilingual fields: merge by lang key, not full replacement
      if (
        LANG_MERGE_FIELDS.has(key) &&
        Array.isArray(baseValue) &&
        Array.isArray(platformOverride)
      ) {
        result[key] = mergeLangArrays(
          baseValue as LangItem[],
          platformOverride as LangItem[],
        );
      } else {
        result[key] = platformOverride;
      }
    } else if (baseValue !== undefined) {
      result[key] = baseValue;
    }
  }

  return result;
}

// Формирует ответ по каждому полю карточки.
// Без шаблона:   { default, platforms }
// С шаблоном:    { isException, default, platforms }
export function assembleCardFields(
  def: CompanyDefault | null,
  template: CompanyTemplate | null,
): Record<string, unknown> {
  const overrides = (def?.fieldOverrides ?? {}) as FieldOverrides;
  const templateFields = (template?.fields ?? {}) as Record<string, unknown>;
  const allKeys = new Set([
    ...Object.keys(templateFields),
    ...Object.keys(overrides),
  ]);
  const result: Record<string, unknown> = {};

  for (const key of allKeys) {
    const override = overrides[key] as FieldOverride | undefined;
    const field: Record<string, unknown> = {};

    const isInTemplate = template !== null && key in templateFields;

    if (!isInTemplate) {
      if (override?.value !== undefined) field['default'] = override.value;
      field['platforms'] = override?.platforms ?? {};
    } else {
      const templateValue = (
        templateFields[key] as { default?: unknown } | undefined
      )?.default;
      // override?.isException — сохраняет прежнее поведение для isException:true
      // без value (legacy-форма, значение только в platforms). overrideHasPriority —
      // фикс Этапа 5.2: isException не задан больше не трактуется как «нет override».
      if (override?.isException || overrideHasPriority(override)) {
        field['isException'] = true;
        if (override?.value !== undefined) field['default'] = override.value;
      } else {
        field['isException'] = false;
        if (templateValue !== undefined) field['default'] = templateValue;
      }
      field['platforms'] = override?.platforms ?? {};
    }

    result[key] = field;
  }

  return result;
}

export function mergeLangArrays(
  base: LangItem[],
  override: LangItem[],
): LangItem[] {
  const result = [...base];
  for (const item of override) {
    const idx = result.findIndex((i) => i.lang === item.lang);
    if (idx >= 0) result[idx] = item;
    else result.push(item);
  }
  return result;
}

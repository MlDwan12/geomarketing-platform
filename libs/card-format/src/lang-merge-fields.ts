// Мультиязычные поля мержатся по языку (а не заменяются целиком) при platform-override.
export const LANG_MERGE_FIELDS = new Set([
  'names',
  'shortNames',
  'altNames',
  'descriptions',
  'shortDescriptions',
]);

export type LangItem = { lang: string; val: string };

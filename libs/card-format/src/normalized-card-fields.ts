import { LangItem } from './lang-merge-fields';

export type PhoneValue = { value: string; comment?: string };
export type CategoryValue = { id: string; name: string };
export type SocialValue = { type: string; value: string };

// Известные поля карточки с конкретной формой значения. Список ключей карточки
// не закрытый — шаблоны/override могут задавать произвольные дополнительные
// ключи (см. card-fields.ts, allKeys собирается динамически), отсюда индексная
// сигнатура для полей, не перечисленных явно.
export interface NormalizedCardFields {
  names?: LangItem[];
  shortNames?: LangItem[];
  altNames?: LangItem[];
  descriptions?: LangItem[];
  shortDescriptions?: LangItem[];
  phones?: PhoneValue[];
  websites?: string[];
  socials?: SocialValue[];
  mainCategory?: CategoryValue;
  additionalCategories?: CategoryValue[];
  schedule?: Record<string, unknown>;
  [key: string]: unknown;
}

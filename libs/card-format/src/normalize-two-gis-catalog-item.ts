import { CategoryValue, NormalizedCardFields } from './normalized-card-fields';

export type TwoGisCatalogItem = {
  name?: string;
  address_name?: string;
  address_comment?: string;
  point?: { lat: number; lon: number };
  reviews?: {
    general_rating?: number;
    general_review_count?: number;
  };
  rubrics?: { id: string; name: string; kind: string }[];
  schedule?: Record<string, unknown>;
  contact_groups?: {
    contacts?: { type: string; value: string; comment?: string }[];
  }[];
};

export function normalizeTwoGisCatalogItem(
  item: TwoGisCatalogItem,
): NormalizedCardFields {
  const primary = item.rubrics?.find((r) => r.kind === 'primary');
  const additional = item.rubrics?.filter((r) => r.kind !== 'primary') ?? [];

  const phones: { value: string; comment?: string }[] = [];
  const websites: string[] = [];
  const socials: { type: string; value: string }[] = [];

  for (const group of item.contact_groups ?? []) {
    for (const c of group.contacts ?? []) {
      if (c.type === 'phone')
        phones.push({ value: c.value, comment: c.comment });
      else if (c.type === 'website') websites.push(c.value);
      else socials.push({ type: c.type, value: c.value });
    }
  }

  const mainCategory: CategoryValue | undefined = primary
    ? { id: primary.id, name: primary.name }
    : undefined;

  return {
    ...(mainCategory ? { mainCategory } : {}),
    ...(additional.length
      ? {
          additionalCategories: additional.map((r) => ({
            id: r.id,
            name: r.name,
          })),
        }
      : {}),
    ...(item.schedule ? { schedule: item.schedule } : {}),
    ...(phones.length ? { phones } : {}),
    ...(websites.length ? { websites } : {}),
    ...(socials.length ? { socials } : {}),
  };
}

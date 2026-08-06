import type { TwoGisPlaceItem } from '../two-gis/two-gis-places.service';
import type { YandexOrgFeature } from '../yandex/yandex-places.service';
import {
  haversineMeters,
  namesLikelyMatch,
  normalizePhoneDigits,
} from '../common/geo-match';

export type PlaceProvider = '2gis' | 'yandex';

export interface PlaceSource {
  provider: PlaceProvider;
  id: string;
  raw: unknown;
}

// Единая форма для клиента — специфика провайдера уходит в sources[].raw,
// здесь только общие поля для отображения списком (см. решение с пользователем:
// нормализованная форма вместо сырых объектов 2ГИС/Яндекса).
export interface NormalizedPlace {
  name: string;
  address?: string;
  phone?: string;
  coordinates?: [number, number]; // [lon, lat]
  categories?: string[];
  // Для CompetitorAnalysisReport (см. docs/refactor-plans/competitor-analysis-report.md,
  // коммит 3) — сравнение рейтинга/кол-ва отзывов с конкурентами. Заполняется
  // только когда провайдер реально отдал эти данные (2ГИС — при запросе fields
  // с 'reviews'); для Яндекса сейчас не заполняется — see normalizeYandexItem.
  rating?: number;
  reviewCount?: number;
  sources: PlaceSource[];
}

export function normalizeTwoGisItem(item: TwoGisPlaceItem): NormalizedPlace {
  const phone = item.contact_groups
    ?.flatMap((g) => g.contacts ?? [])
    .find((c) => c.type === 'phone')?.value;

  return {
    name: item.name ?? '',
    address: item.full_address_name ?? item.address_name,
    phone,
    coordinates: item.point ? [item.point.lon, item.point.lat] : undefined,
    categories: item.rubrics?.map((r) => r.name),
    rating: item.reviews?.general_rating,
    reviewCount: item.reviews?.general_review_count,
    sources: [{ provider: '2gis', id: item.id, raw: item }],
  };
}

export function normalizeYandexItem(
  feature: YandexOrgFeature,
): NormalizedPlace {
  const meta = feature.properties?.CompanyMetaData;

  return {
    name: meta?.name ?? feature.properties?.name ?? '',
    address: meta?.address,
    phone: meta?.Phones?.[0]?.formatted,
    coordinates: feature.geometry?.coordinates,
    categories: meta?.Categories?.map((c) => c.name).filter((n): n is string =>
      Boolean(n),
    ),
    // YandexOrgFeature.CompanyMetaData не содержит поля рейтинга в текущем
    // типе — не проверено живым запросом, какое имя поля использует Яндекс
    // (или используется ли оно вообще для type=biz). Не гадаем — rating/
    // reviewCount остаются undefined, пока не подтверждено живьём.
    sources: [{ provider: 'yandex', id: meta?.id ?? '', raw: feature }],
  };
}

// Порог дистанции подобран на глаз: соседние здания/точки входа одной
// организации обычно укладываются в ~150м, но это уже разные организации
// в среднем городском квартале — компромисс между полнотой и ложными мержами.
const DISTANCE_THRESHOLD_METERS = 150;
// Левенштейн-схожесть 0..1 (1 — идентичные строки после нормализации).
const NAME_SIMILARITY_THRESHOLD = 0.5;

// Мерджим только между разными провайдерами. Внутри одного провайдера два
// близких похожих результата чаще всего — разные соседние филиалы одной сети
// (проверено живым запросом: Яндекс сам вернул два разных "Кафе Пушкинъ"
// рядом), а не дубль одной и той же организации — схлопывать их было бы
// потерей данных.
function hasProviderOverlap(a: NormalizedPlace, b: NormalizedPlace): boolean {
  const providersA = new Set(a.sources.map((s) => s.provider));
  return b.sources.some((s) => providersA.has(s.provider));
}

function isDuplicate(a: NormalizedPlace, b: NormalizedPlace): boolean {
  if (hasProviderOverlap(a, b)) return false;
  if (!a.coordinates || !b.coordinates) return false;
  if (
    haversineMeters(a.coordinates, b.coordinates) > DISTANCE_THRESHOLD_METERS
  ) {
    return false;
  }
  if (!namesLikelyMatch(a.name, b.name, NAME_SIMILARITY_THRESHOLD)) {
    return false;
  }

  // Телефон — доп. сигнал, только когда он есть у обеих записей: если оба
  // провайдера отдали телефон и он не совпал — это, вероятнее всего, разные
  // организации по соседству, даже при похожем названии и близких
  // координатах. Если телефона нет хотя бы у одной записи — не блокируем
  // мёрдж, просто нет доп. сигнала для проверки.
  if (a.phone && b.phone) {
    return normalizePhoneDigits(a.phone) === normalizePhoneDigits(b.phone);
  }

  return true;
}

// Жадный O(n²) мёрдж — приемлемо для размеров одной страницы поиска (~10-50).
// Первая запись-кандидат определяет отображаемые поля (name/address/phone),
// у совпавших дублей забирается только sources — сырые данные не теряются.
export function dedupePlaces(items: NormalizedPlace[]): NormalizedPlace[] {
  const merged: NormalizedPlace[] = [];

  for (const item of items) {
    const match = merged.find((m) => isDuplicate(m, item));
    if (match) {
      match.sources.push(...item.sources);
    } else {
      merged.push({ ...item, sources: [...item.sources] });
    }
  }

  return merged;
}

import type { TwoGisPlaceItem } from '../two-gis/two-gis-places.service';
import type { YandexOrgFeature } from '../yandex/yandex-places.service';

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
    sources: [{ provider: 'yandex', id: meta?.id ?? '', raw: feature }],
  };
}

// Порог дистанции подобран на глаз: соседние здания/точки входа одной
// организации обычно укладываются в ~150м, но это уже разные организации
// в среднем городском квартале — компромисс между полнотой и ложными мержами.
const DISTANCE_THRESHOLD_METERS = 150;
// Левенштейн-схожесть 0..1 (1 — идентичные строки после нормализации).
const NAME_SIMILARITY_THRESHOLD = 0.5;

function haversineMeters(a: [number, number], b: [number, number]): number {
  const R = 6371000;
  const [lon1, lat1] = a;
  const [lon2, lat2] = b;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);
  const h =
    sinLat * sinLat +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * sinLon * sinLon;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[«»"'.,]/g, '')
    .replace(/\s+/g, ' ');
}

function levenshtein(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0),
  );
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }

  return dp[a.length][b.length];
}

function nameSimilarity(a: string, b: string): number {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return 0;
  const dist = levenshtein(na, nb);
  return 1 - dist / Math.max(na.length, nb.length);
}

// Мерджим только между разными провайдерами. Внутри одного провайдера два
// близких похожих результата чаще всего — разные соседние филиалы одной сети
// (проверено живым запросом: Яндекс сам вернул два разных "Кафе Пушкинъ"
// рядом), а не дубль одной и той же организации — схлопывать их было бы
// потерей данных.
function hasProviderOverlap(a: NormalizedPlace, b: NormalizedPlace): boolean {
  const providersA = new Set(a.sources.map((s) => s.provider));
  return b.sources.some((s) => providersA.has(s.provider));
}

// Только цифры; российский "8ХХХХХХХХХХ" и "+7ХХХХХХХХХХ" — один и тот же
// номер с точностью до кода страны, приводим к общему виду.
function normalizePhoneDigits(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('8')) {
    return '7' + digits.slice(1);
  }
  return digits;
}

function isDuplicate(a: NormalizedPlace, b: NormalizedPlace): boolean {
  if (hasProviderOverlap(a, b)) return false;
  if (!a.coordinates || !b.coordinates) return false;
  if (
    haversineMeters(a.coordinates, b.coordinates) > DISTANCE_THRESHOLD_METERS
  ) {
    return false;
  }
  if (nameSimilarity(a.name, b.name) < NAME_SIMILARITY_THRESHOLD) return false;

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

// Общие примитивы сопоставления мест: расстояние по координатам, схожесть
// названий и телефонов. Используются и в дедупе объединённого поиска
// (places-search/normalize.ts — строгая политика для авто-мёрджа), и в
// проверке MapVisibility (map-visibility/ — более мягкая политика для
// результатов на ручной просмотр человеком). Сами пороги/политика мёрджа
// специфичны для каждого места использования и здесь не заданы.

export function haversineMeters(
  a: [number, number],
  b: [number, number],
): number {
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

// Левенштейн-схожесть 0..1 (1 — идентичные строки после нормализации).
export function nameSimilarity(a: string, b: string): number {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return 0;
  const dist = levenshtein(na, nb);
  return 1 - dist / Math.max(na.length, nb.length);
}

function isPrefixMatch(a: string, b: string): boolean {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return false;
  const shorter = na.length <= nb.length ? na : nb;
  const longer = na.length <= nb.length ? nb : na;
  return (
    longer.startsWith(shorter) &&
    (longer.length === shorter.length || longer[shorter.length] === ' ')
  );
}

// Схожи ли названия — по Левенштейн-порогу, либо одно является префиксом
// другого (граница по пробелу). Второе покрывает частый паттерн 2ГИС: name
// содержит "<название>, <категория>" (например, "Кафе Пушкинъ, ресторан
// русской кухни"), где Левенштейн-схожесть с чистым "Кафе Пушкинъ" от
// другого провайдера падает ниже разумного порога просто из-за длины
// приписанного текста — проверено живым сопоставлением 2ГИС/Яндекс.
export function namesLikelyMatch(
  a: string,
  b: string,
  threshold: number,
): boolean {
  if (nameSimilarity(a, b) >= threshold) return true;
  return isPrefixMatch(a, b);
}

// Только цифры; российский "8ХХХХХХХХХХ" и "+7ХХХХХХХХХХ" — один и тот же
// номер с точностью до кода страны, приводим к общему виду.
export function normalizePhoneDigits(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('8')) {
    return '7' + digits.slice(1);
  }
  return digits;
}

import { NormalizedPlace } from '../places-search/normalize';
import {
  haversineMeters,
  namesLikelyMatch,
  nameSimilarity,
} from '../common/geo-match';

// Минимальный набор полей Company, нужных для сопоставления (см.
// CompanyService.listForVisibility) — не полная сущность.
export interface CompanyRef {
  id: string;
  name: string;
  address?: string | null;
  coordinates?: [number, number] | null;
}

export type MatchConfidence = 'high' | 'low';

export interface MatchResult {
  matched: boolean;
  confidence?: MatchConfidence;
}

const DISTANCE_THRESHOLD_METERS = 150;
// При наличии координат — тот же порог, что и в дедупе поиска (places-search/normalize.ts).
const NAME_SIMILARITY_THRESHOLD_WITH_COORDS = 0.5;
// Без координат совпадение только по тексту — сигнала меньше, порог строже,
// чтобы не заваливать пользователя случайными совпадениями по общим словам
// в названии (см. ADDRESS_SIMILARITY_THRESHOLD ниже — доп. гейт по адресу).
const NAME_SIMILARITY_THRESHOLD_TEXT_ONLY = 0.7;
const ADDRESS_SIMILARITY_THRESHOLD = 0.4;

// В отличие от дедупа объединённого поиска (normalize.ts.isDuplicate), результат
// здесь идёт человеку на подтверждение («это твоя точка?»), а не в автоматический
// мёрдж — поэтому политика мягче и не переиспользует isDuplicate напрямую: без
// координат у Company (старые записи до миграции coordinates) всё равно даёт
// результат, просто с confidence: 'low' вместо отказа.
export function matchesCompany(
  company: CompanyRef,
  candidate: NormalizedPlace,
): MatchResult {
  if (company.coordinates && candidate.coordinates) {
    if (
      haversineMeters(company.coordinates, candidate.coordinates) >
      DISTANCE_THRESHOLD_METERS
    ) {
      return { matched: false };
    }
    if (
      !namesLikelyMatch(
        company.name,
        candidate.name,
        NAME_SIMILARITY_THRESHOLD_WITH_COORDS,
      )
    ) {
      return { matched: false };
    }
    return { matched: true, confidence: 'high' };
  }

  if (
    !namesLikelyMatch(
      company.name,
      candidate.name,
      NAME_SIMILARITY_THRESHOLD_TEXT_ONLY,
    )
  ) {
    return { matched: false };
  }

  if (company.address && candidate.address) {
    if (
      nameSimilarity(company.address, candidate.address) <
      ADDRESS_SIMILARITY_THRESHOLD
    ) {
      return { matched: false };
    }
  }

  return { matched: true, confidence: 'low' };
}

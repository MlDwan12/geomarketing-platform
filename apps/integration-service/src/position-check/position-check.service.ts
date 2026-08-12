import { Injectable } from '@nestjs/common';
import { TwoGisPlacesService } from '../two-gis/two-gis-places.service';
import { YandexPlacesService } from '../yandex/yandex-places.service';
import { CompanyRef } from '../map-visibility/visibility-match';
import { MapProviderKey } from '../common/own-listing-finder';
import { findPosition } from './position-check';

const PROVIDERS: MapProviderKey[] = ['2gis', 'yandex'];

export interface PositionCheckEntry {
  keyword: string;
  provider: MapProviderKey;
  position: number | null;
}

// Расчёт позиции для чекера позиций (см.
// docs/refactor-plans/position-checker.md, коммит 3) — только вычисление, без
// хранения (история/CRUD ключевых слов — core-service, коммиты 1-2).
@Injectable()
export class PositionCheckService {
  constructor(
    private readonly twoGis: TwoGisPlacesService,
    private readonly yandex: YandexPlacesService,
  ) {}

  async checkKeywords(
    company: CompanyRef,
    keywords: string[],
  ): Promise<PositionCheckEntry[]> {
    if (!company.coordinates || !keywords.length) return [];

    const clients = { twoGis: this.twoGis, yandex: this.yandex };

    const results = await Promise.all(
      keywords.flatMap((keyword) =>
        PROVIDERS.map((provider) =>
          this.checkOne(company, keyword, provider, clients),
        ),
      ),
    );

    return results.filter(
      (entry): entry is PositionCheckEntry => entry !== null,
    );
  }

  private async checkOne(
    company: CompanyRef,
    keyword: string,
    provider: MapProviderKey,
    clients: { twoGis: TwoGisPlacesService; yandex: YandexPlacesService },
  ): Promise<PositionCheckEntry | null> {
    try {
      const position = await findPosition(company, keyword, provider, clients);
      return { keyword, provider, position };
    } catch {
      // Партиальный успех — упавший запрос на одного провайдера/ключевое
      // слово не валит остальные (тот же принцип, что
      // CompetitorListingsService.searchProviderCompetitors). Результат
      // просто не попадает в массив — не сохраняется как "не найдено"
      // (position: null означает "проверено, не найдено", а не "не удалось
      // проверить").
      return null;
    }
  }
}

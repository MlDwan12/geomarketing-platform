import { PositionCheckService } from './position-check.service';
import { TwoGisPlacesService } from '../two-gis/two-gis-places.service';
import { YandexPlacesService } from '../yandex/yandex-places.service';
import { CompanyRef } from '../map-visibility/visibility-match';
import * as positionCheck from './position-check';

const company: CompanyRef = {
  id: 'company-1',
  name: 'Моё Кафе',
  coordinates: [37.6, 55.75],
};

describe('PositionCheckService.checkKeywords', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('проверяет оба провайдера для каждого ключевого слова', async () => {
    jest
      .spyOn(positionCheck, 'findPosition')
      .mockImplementation((_company, keyword, provider) =>
        Promise.resolve(provider === '2gis' ? 0 : 3),
      );
    const service = new PositionCheckService(
      {} as TwoGisPlacesService,
      {} as YandexPlacesService,
    );

    const result = await service.checkKeywords(company, ['кафе', 'кофейня']);

    expect(result).toEqual(
      expect.arrayContaining([
        { keyword: 'кафе', provider: '2gis', position: 0 },
        { keyword: 'кафе', provider: 'yandex', position: 3 },
        { keyword: 'кофейня', provider: '2gis', position: 0 },
        { keyword: 'кофейня', provider: 'yandex', position: 3 },
      ]),
    );
    expect(result).toHaveLength(4);
  });

  it('падение одного провайдера/слова не валит остальные (partial success)', async () => {
    jest
      .spyOn(positionCheck, 'findPosition')
      .mockImplementation((_company, keyword, provider) => {
        if (provider === '2gis') return Promise.reject(new Error('2gis down'));
        return Promise.resolve(2);
      });
    const service = new PositionCheckService(
      {} as TwoGisPlacesService,
      {} as YandexPlacesService,
    );

    const result = await service.checkKeywords(company, ['кафе']);

    expect(result).toEqual([
      { keyword: 'кафе', provider: 'yandex', position: 2 },
    ]);
  });

  it('без координат у Company — пустой список, без вызовов', async () => {
    const findPositionSpy = jest.spyOn(positionCheck, 'findPosition');
    const service = new PositionCheckService(
      {} as TwoGisPlacesService,
      {} as YandexPlacesService,
    );

    const result = await service.checkKeywords({ id: 'c1', name: 'Х' }, [
      'кафе',
    ]);

    expect(result).toEqual([]);
    expect(findPositionSpy).not.toHaveBeenCalled();
  });

  it('пустой список ключевых слов — пустой результат, без вызовов', async () => {
    const findPositionSpy = jest.spyOn(positionCheck, 'findPosition');
    const service = new PositionCheckService(
      {} as TwoGisPlacesService,
      {} as YandexPlacesService,
    );

    const result = await service.checkKeywords(company, []);

    expect(result).toEqual([]);
    expect(findPositionSpy).not.toHaveBeenCalled();
  });
});

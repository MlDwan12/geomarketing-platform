import { RpcException } from '@nestjs/microservices';
import { YandexController } from './yandex.controller';
import { YandexPlacesService } from './yandex-places.service';

function fakePlacesService(result: unknown = { items: [], total: 0 }) {
  const searchPlaces = jest.fn().mockResolvedValue(result);
  const service = { searchPlaces } as unknown as YandexPlacesService;
  return { service, searchPlaces };
}

describe('YandexController.searchPlaces', () => {
  it('пустой query → RpcException 400, сервис не вызывается', () => {
    const { service, searchPlaces } = fakePlacesService();
    const controller = new YandexController(service);

    expect(() => controller.searchPlaces({ query: '' })).toThrow(RpcException);
    expect(searchPlaces).not.toHaveBeenCalled();
  });

  it('query из одних пробелов → тоже считается пустым', () => {
    const { service } = fakePlacesService();
    const controller = new YandexController(service);

    expect(() => controller.searchPlaces({ query: '   ' })).toThrow(
      RpcException,
    );
  });

  it('непустой query → делегирует в YandexPlacesService.searchPlaces с тем же payload', async () => {
    const expected = { items: [{ type: 'Feature' }], total: 1 };
    const { service, searchPlaces } = fakePlacesService(expected);
    const controller = new YandexController(service);
    const payload = { query: 'кафе', ll: '82.9,55.0' };

    const result = await controller.searchPlaces(payload);

    expect(searchPlaces).toHaveBeenCalledWith(payload);
    expect(result).toBe(expected);
  });
});

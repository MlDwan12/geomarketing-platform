import { RpcException } from '@nestjs/microservices';
import { TwoGisController } from './two-gis.controller';
import { TwoGisPlacesService } from './two-gis-places.service';

function fakePlacesService(result: unknown = { items: [], total: 0 }) {
  const searchPlaces = jest.fn().mockResolvedValue(result);
  const service = { searchPlaces } as unknown as TwoGisPlacesService;
  return { service, searchPlaces };
}

describe('TwoGisController.searchPlaces', () => {
  it('пустой query → RpcException 400, сервис не вызывается', () => {
    const { service, searchPlaces } = fakePlacesService();
    const controller = new TwoGisController(service);

    expect(() => controller.searchPlaces({ query: '' })).toThrow(RpcException);
    expect(searchPlaces).not.toHaveBeenCalled();
  });

  it('query из одних пробелов → тоже считается пустым', () => {
    const { service } = fakePlacesService();
    const controller = new TwoGisController(service);

    expect(() => controller.searchPlaces({ query: '   ' })).toThrow(
      RpcException,
    );
  });

  it('непустой query → делегирует в TwoGisPlacesService.searchPlaces с тем же payload', async () => {
    const expected = { items: [{ id: '1' }], total: 1 };
    const { service, searchPlaces } = fakePlacesService(expected);
    const controller = new TwoGisController(service);
    const payload = { query: 'кафе', location: '82.9,55.0' };

    const result = await controller.searchPlaces(payload);

    expect(searchPlaces).toHaveBeenCalledWith(payload);
    expect(result).toBe(expected);
  });
});

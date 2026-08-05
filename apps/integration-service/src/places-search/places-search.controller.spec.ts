import { RpcException } from '@nestjs/microservices';
import { PlacesSearchController } from './places-search.controller';
import { PlacesSearchService } from './places-search.service';

function fakeSearchService(
  result: unknown = { items: [], total: 0, failedSources: [] },
) {
  const search = jest.fn().mockResolvedValue(result);
  const service = { search } as unknown as PlacesSearchService;
  return { service, search };
}

describe('PlacesSearchController.searchAll', () => {
  it('пустой query → RpcException 400, сервис не вызывается', () => {
    const { service, search } = fakeSearchService();
    const controller = new PlacesSearchController(service);

    expect(() => controller.searchAll({ query: '' })).toThrow(RpcException);
    expect(search).not.toHaveBeenCalled();
  });

  it('непустой query → делегирует в PlacesSearchService.search с тем же payload', async () => {
    const expected = { items: [{ name: 'A' }], total: 1, failedSources: [] };
    const { service, search } = fakeSearchService(expected);
    const controller = new PlacesSearchController(service);
    const payload = { query: 'кафе', location: '37.6,55.75' };

    const result = await controller.searchAll(payload);

    expect(search).toHaveBeenCalledWith(payload);
    expect(result).toBe(expected);
  });
});

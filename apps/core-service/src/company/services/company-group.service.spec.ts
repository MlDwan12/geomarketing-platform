import { RpcException } from '@nestjs/microservices';
import { CompanyGroupService } from './company-group.service';
import { CompanyAccessService } from './company-access.service';
import { BrandRole } from '../../brand/user-brand.entity';

function fakeAccess(assertBrandAccess: jest.Mock) {
  const service = { assertBrandAccess } as unknown as CompanyAccessService;
  return { service, assertBrandAccess };
}

describe('CompanyGroupService — ролевые проверки', () => {
  it('createGroup(): требует минимум BrandRole.Manager', async () => {
    const forbidden = new RpcException({ status: 403, message: 'Forbidden' });
    const access = fakeAccess(jest.fn().mockRejectedValue(forbidden));
    const service = new CompanyGroupService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      access.service,
    );

    await expect(
      service.createGroup({ brandId: 'brand-1', userId: 'user-1', name: 'Юг' }),
    ).rejects.toThrow(RpcException);
    expect(access.assertBrandAccess).toHaveBeenCalledWith(
      'brand-1',
      'user-1',
      BrandRole.Manager,
    );
  });
});

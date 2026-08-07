import { RpcException } from '@nestjs/microservices';
import { CompanyPlatformService } from './company-platform.service';
import { CompanyAccessService } from './company-access.service';
import { Company } from '../entities/company.entity';
import { BrandRole } from '../../brand/user-brand.entity';

function fakeAccess(company: Partial<Company>, assertBrandAccess: jest.Mock) {
  const getCompanyOrThrow = jest.fn().mockResolvedValue(company);
  const service = {
    assertBrandAccess,
    getCompanyOrThrow,
  } as unknown as CompanyAccessService;
  return { service, assertBrandAccess, getCompanyOrThrow };
}

describe('CompanyPlatformService — ролевые проверки', () => {
  it('updatePlatform(): требует минимум BrandRole.Manager', async () => {
    const forbidden = new RpcException({ status: 403, message: 'Forbidden' });
    const access = fakeAccess(
      { id: 'c1', brandId: 'brand-1' },
      jest.fn().mockRejectedValue(forbidden),
    );
    const service = new CompanyPlatformService(
      {} as never,
      {} as never,
      access.service,
    );

    await expect(
      service.updatePlatform('c1', 'user-1', 'yandex', {}, 'brand-1'),
    ).rejects.toThrow(RpcException);
    expect(access.assertBrandAccess).toHaveBeenCalledWith(
      'brand-1',
      'user-1',
      BrandRole.Manager,
    );
  });
});

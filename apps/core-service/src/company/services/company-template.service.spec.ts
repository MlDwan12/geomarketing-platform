import { Repository } from 'typeorm';
import { RpcException } from '@nestjs/microservices';
import { CompanyTemplateService } from './company-template.service';
import { CompanyAccessService } from './company-access.service';
import { CompanyTemplate } from '../entities/company-template.entity';
import { BrandRole } from '../../brand/user-brand.entity';

function fakeAccess(assertBrandAccess: jest.Mock) {
  const service = { assertBrandAccess } as unknown as CompanyAccessService;
  return { service, assertBrandAccess };
}

describe('CompanyTemplateService — ролевые проверки', () => {
  it('createTemplate(): требует минимум BrandRole.Manager', async () => {
    const forbidden = new RpcException({ status: 403, message: 'Forbidden' });
    const access = fakeAccess(jest.fn().mockRejectedValue(forbidden));
    const service = new CompanyTemplateService(
      {} as never,
      {} as never,
      {} as unknown as Repository<CompanyTemplate>,
      {} as never,
      access.service,
    );

    await expect(
      service.createTemplate({
        brandId: 'brand-1',
        userId: 'user-1',
        name: 'Шаблон',
        fields: {},
      }),
    ).rejects.toThrow(RpcException);
    expect(access.assertBrandAccess).toHaveBeenCalledWith(
      'brand-1',
      'user-1',
      BrandRole.Manager,
    );
  });
});

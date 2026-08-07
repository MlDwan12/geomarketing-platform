import { Repository } from 'typeorm';
import { RpcException } from '@nestjs/microservices';
import { CompanyAccessService } from './company-access.service';
import { Company } from '../entities/company.entity';
import { BrandRole, UserBrand } from '../../brand/user-brand.entity';

function fakeUserBrandRepo(membership: Partial<UserBrand> | null) {
  const findOne = jest.fn().mockResolvedValue(membership);
  const repo = { findOne } as unknown as Repository<UserBrand>;
  return { repo, findOne };
}

function makeService(membership: Partial<UserBrand> | null) {
  const companyRepo = {} as unknown as Repository<Company>;
  const userBrand = fakeUserBrandRepo(membership);
  const service = new CompanyAccessService(companyRepo, userBrand.repo);
  return { service, findOne: userBrand.findOne };
}

describe('CompanyAccessService.assertBrandAccess', () => {
  it('Viewer проходит проверку без явной минимальной роли (дефолт — Viewer)', async () => {
    const { service } = makeService({ role: BrandRole.Viewer });

    await expect(
      service.assertBrandAccess('brand-1', 'user-1'),
    ).resolves.toEqual(expect.objectContaining({ role: BrandRole.Viewer }));
  });

  it('Viewer не проходит проверку с минимальной ролью Manager', async () => {
    const { service } = makeService({ role: BrandRole.Viewer });

    await expect(
      service.assertBrandAccess('brand-1', 'user-1', BrandRole.Manager),
    ).rejects.toThrow(RpcException);
  });

  it('Manager проходит проверку с минимальной ролью Manager, но не Owner', async () => {
    const { service } = makeService({ role: BrandRole.Manager });

    await expect(
      service.assertBrandAccess('brand-1', 'user-1', BrandRole.Manager),
    ).resolves.toEqual(expect.objectContaining({ role: BrandRole.Manager }));

    await expect(
      service.assertBrandAccess('brand-1', 'user-1', BrandRole.Owner),
    ).rejects.toThrow(RpcException);
  });

  it('Owner проходит проверку на любом уровне', async () => {
    const { service } = makeService({ role: BrandRole.Owner });

    await expect(
      service.assertBrandAccess('brand-1', 'user-1', BrandRole.Owner),
    ).resolves.toEqual(expect.objectContaining({ role: BrandRole.Owner }));
  });

  it('без членства в бренде — 403 независимо от минимальной роли', async () => {
    const { service } = makeService(null);

    await expect(
      service.assertBrandAccess('brand-1', 'user-1'),
    ).rejects.toThrow(RpcException);
  });
});

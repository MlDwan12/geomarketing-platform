import { Repository } from 'typeorm';
import { RpcException } from '@nestjs/microservices';
import { BrandService } from './brand.service';
import { Brand, BrandStatus } from './brand.entity';
import { BrandRole, UserBrand } from './user-brand.entity';

function fakeBrandRepo(brand: Partial<Brand> | null) {
  const findOne = jest.fn().mockResolvedValue(brand);
  const save = jest.fn().mockImplementation((b: Partial<Brand>) => b);
  const repo = { findOne, save } as unknown as Repository<Brand>;
  return { repo, findOne, save };
}

function fakeUserBrandRepo(membership: Partial<UserBrand> | null) {
  const findOne = jest.fn().mockResolvedValue(membership);
  const repo = { findOne } as unknown as Repository<UserBrand>;
  return { repo, findOne };
}

describe('BrandService — ролевые проверки', () => {
  it('delete(): Owner может удалить бренд', async () => {
    const brand = fakeBrandRepo({
      id: 'brand-1',
      ownerId: 'user-1',
      status: BrandStatus.Active,
    });
    const userBrand = fakeUserBrandRepo({ role: BrandRole.Owner });
    const service = new BrandService(brand.repo, userBrand.repo);

    await service.delete('brand-1', 'user-1');

    expect(brand.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: BrandStatus.Deleted }),
    );
  });

  it('delete(): Manager не может удалить бренд (нужен Owner)', async () => {
    const brand = fakeBrandRepo({
      id: 'brand-1',
      ownerId: 'user-1',
      status: BrandStatus.Active,
    });
    const userBrand = fakeUserBrandRepo({ role: BrandRole.Manager });
    const service = new BrandService(brand.repo, userBrand.repo);

    await expect(service.delete('brand-1', 'user-2')).rejects.toThrow(
      RpcException,
    );
    expect(brand.save).not.toHaveBeenCalled();
  });

  it('update(): Manager не может менять настройки бренда (нужен Owner)', async () => {
    const brand = fakeBrandRepo({
      id: 'brand-1',
      ownerId: 'user-1',
      name: 'Старое имя',
      status: BrandStatus.Active,
    });
    const userBrand = fakeUserBrandRepo({ role: BrandRole.Manager });
    const service = new BrandService(brand.repo, userBrand.repo);

    await expect(
      service.update('brand-1', { name: 'Новое имя', userId: 'user-2' }),
    ).rejects.toThrow(RpcException);
    expect(brand.save).not.toHaveBeenCalled();
  });

  it('get(): без членства в бренде — 403', async () => {
    const brand = fakeBrandRepo({ id: 'brand-1', status: BrandStatus.Active });
    const userBrand = fakeUserBrandRepo(null);
    const service = new BrandService(brand.repo, userBrand.repo);

    await expect(service.get('brand-1', 'stranger')).rejects.toThrow(
      RpcException,
    );
  });
});

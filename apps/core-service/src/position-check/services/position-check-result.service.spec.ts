import { Repository } from 'typeorm';
import { RpcException } from '@nestjs/microservices';
import { PositionCheckResultService } from './position-check-result.service';
import { PositionCheckResult } from '../entities/position-check-result.entity';
import { CompanyAccessService } from '../../company/services/company-access.service';
import { Company } from '../../company/entities/company.entity';
import { BrandRole } from '../../brand/user-brand.entity';

function fakeAccess(company: Partial<Company> | null) {
  const assertBrandAccess = jest.fn().mockResolvedValue(undefined);
  const getCompanyOrThrow = jest.fn().mockImplementation(() => {
    if (!company) {
      throw new RpcException({ status: 404, message: 'Company not found' });
    }
    return Promise.resolve(company as Company);
  });
  const service = {
    assertBrandAccess,
    getCompanyOrThrow,
  } as unknown as CompanyAccessService;
  return { service, assertBrandAccess, getCompanyOrThrow };
}

function fakeRepo() {
  const create = jest
    .fn()
    .mockImplementation((entity: Partial<PositionCheckResult>) => entity);
  const save = jest
    .fn()
    .mockImplementation((entities: Partial<PositionCheckResult>[]) =>
      entities.map((e, i) => ({
        id: `result-${i}`,
        checkedAt: new Date('2026-08-12T00:00:00Z'),
        ...e,
      })),
    );
  const find = jest.fn();
  const repo = {
    create,
    save,
    find,
  } as unknown as Repository<PositionCheckResult>;
  return { repo, create, save, find };
}

describe('PositionCheckResultService', () => {
  it('save() сохраняет батч результатов после проверки доступа', async () => {
    const access = fakeAccess({ id: 'company-1', brandId: 'brand-1' });
    const repo = fakeRepo();
    const service = new PositionCheckResultService(repo.repo, access.service);

    const results = await service.save('company-1', 'brand-1', 'user-1', [
      { keyword: 'кофейня', source: 'auto', provider: '2gis', position: 2 },
      {
        keyword: 'кофейня',
        source: 'auto',
        provider: 'yandex',
        position: null,
      },
    ]);

    expect(access.assertBrandAccess).toHaveBeenCalledWith(
      'brand-1',
      'user-1',
      BrandRole.Manager,
    );
    expect(repo.save).toHaveBeenCalledWith([
      expect.objectContaining({
        companyId: 'company-1',
        keyword: 'кофейня',
        source: 'auto',
        provider: '2gis',
        position: 2,
      }),
      expect.objectContaining({
        companyId: 'company-1',
        keyword: 'кофейня',
        source: 'auto',
        provider: 'yandex',
        position: null,
      }),
    ]);
    expect(results).toHaveLength(2);
  });

  it('save() с пустым списком результатов ничего не пишет', async () => {
    const access = fakeAccess({ id: 'company-1', brandId: 'brand-1' });
    const repo = fakeRepo();
    const service = new PositionCheckResultService(repo.repo, access.service);

    const results = await service.save('company-1', 'brand-1', 'user-1', []);

    expect(repo.save).not.toHaveBeenCalled();
    expect(results).toEqual([]);
  });

  it('save() бросает 404, если компания принадлежит другому бренду', async () => {
    const access = fakeAccess({ id: 'company-1', brandId: 'other-brand' });
    const repo = fakeRepo();
    const service = new PositionCheckResultService(repo.repo, access.service);

    await expect(
      service.save('company-1', 'brand-1', 'user-1', [
        { keyword: 'кофейня', source: 'auto', provider: '2gis', position: 1 },
      ]),
    ).rejects.toThrow(RpcException);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('history() без фильтра возвращает всю историю компании по checkedAt DESC', async () => {
    const access = fakeAccess({ id: 'company-1', brandId: 'brand-1' });
    const repo = fakeRepo();
    repo.find.mockResolvedValue([{ id: 'r2' }, { id: 'r1' }]);
    const service = new PositionCheckResultService(repo.repo, access.service);

    const result = await service.history('company-1', 'brand-1', 'user-1');

    expect(repo.find).toHaveBeenCalledWith({
      where: { companyId: 'company-1' },
      order: { checkedAt: 'DESC' },
    });
    expect(result).toEqual([{ id: 'r2' }, { id: 'r1' }]);
  });

  it('history() с фильтром по keyword сужает выборку', async () => {
    const access = fakeAccess({ id: 'company-1', brandId: 'brand-1' });
    const repo = fakeRepo();
    repo.find.mockResolvedValue([{ id: 'r1' }]);
    const service = new PositionCheckResultService(repo.repo, access.service);

    await service.history('company-1', 'brand-1', 'user-1', 'кофейня');

    expect(repo.find).toHaveBeenCalledWith({
      where: { companyId: 'company-1', keyword: 'кофейня' },
      order: { checkedAt: 'DESC' },
    });
  });
});

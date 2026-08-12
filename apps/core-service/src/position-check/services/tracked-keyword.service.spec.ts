import { Repository } from 'typeorm';
import { RpcException } from '@nestjs/microservices';
import { TrackedKeywordService } from './tracked-keyword.service';
import { TrackedKeyword } from '../entities/tracked-keyword.entity';
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
    .mockImplementation((entity: Partial<TrackedKeyword>) => entity);
  const save = jest
    .fn()
    .mockImplementation((entity: Partial<TrackedKeyword>) => ({
      id: 'keyword-1',
      createdAt: new Date('2026-08-12T00:00:00Z'),
      ...entity,
    }));
  const findOne = jest.fn();
  const find = jest.fn();
  const deleteFn = jest.fn();
  const repo = {
    create,
    save,
    findOne,
    find,
    delete: deleteFn,
  } as unknown as Repository<TrackedKeyword>;
  return { repo, create, save, findOne, find, delete: deleteFn };
}

describe('TrackedKeywordService', () => {
  it('add() сохраняет новое слово после проверки доступа к бренду и компании', async () => {
    const access = fakeAccess({ id: 'company-1', brandId: 'brand-1' });
    const repo = fakeRepo();
    repo.findOne.mockResolvedValue(null);
    const service = new TrackedKeywordService(repo.repo, access.service);

    const result = await service.add(
      'company-1',
      'brand-1',
      'user-1',
      'кофейня',
    );

    expect(access.assertBrandAccess).toHaveBeenCalledWith(
      'brand-1',
      'user-1',
      BrandRole.Manager,
    );
    expect(access.getCompanyOrThrow).toHaveBeenCalledWith('company-1');
    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({ companyId: 'company-1', keyword: 'кофейня' }),
    );
    expect(result.id).toBe('keyword-1');
  });

  it('add() повторного слова не создаёт дубль — возвращает существующую запись', async () => {
    const access = fakeAccess({ id: 'company-1', brandId: 'brand-1' });
    const repo = fakeRepo();
    repo.findOne.mockResolvedValue({
      id: 'keyword-existing',
      companyId: 'company-1',
      keyword: 'кофейня',
      createdAt: new Date('2026-08-01T00:00:00Z'),
    });
    const service = new TrackedKeywordService(repo.repo, access.service);

    const result = await service.add(
      'company-1',
      'brand-1',
      'user-1',
      'кофейня',
    );

    expect(result.id).toBe('keyword-existing');
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('add() бросает 404, если компания принадлежит другому бренду', async () => {
    const access = fakeAccess({ id: 'company-1', brandId: 'other-brand' });
    const repo = fakeRepo();
    const service = new TrackedKeywordService(repo.repo, access.service);

    await expect(
      service.add('company-1', 'brand-1', 'user-1', 'кофейня'),
    ).rejects.toThrow(RpcException);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('remove() удаляет слово по companyId+keyword и возвращает null', async () => {
    const access = fakeAccess({ id: 'company-1', brandId: 'brand-1' });
    const repo = fakeRepo();
    const service = new TrackedKeywordService(repo.repo, access.service);

    const result = await service.remove(
      'company-1',
      'brand-1',
      'user-1',
      'кофейня',
    );

    expect(repo.delete).toHaveBeenCalledWith({
      companyId: 'company-1',
      keyword: 'кофейня',
    });
    expect(result).toBeNull();
  });

  it('listForCompany() возвращает список слов компании, отсортированный по createdAt ASC', async () => {
    const access = fakeAccess({ id: 'company-1', brandId: 'brand-1' });
    const repo = fakeRepo();
    repo.find.mockResolvedValue([{ id: 'k1' }, { id: 'k2' }]);
    const service = new TrackedKeywordService(repo.repo, access.service);

    const result = await service.listForCompany(
      'company-1',
      'brand-1',
      'user-1',
    );

    expect(repo.find).toHaveBeenCalledWith({
      where: { companyId: 'company-1' },
      order: { createdAt: 'ASC' },
    });
    expect(result).toEqual([{ id: 'k1' }, { id: 'k2' }]);
  });

  it('listForCompany() для новой компании без слов возвращает пустой список', async () => {
    const access = fakeAccess({ id: 'company-1', brandId: 'brand-1' });
    const repo = fakeRepo();
    repo.find.mockResolvedValue([]);
    const service = new TrackedKeywordService(repo.repo, access.service);

    const result = await service.listForCompany(
      'company-1',
      'brand-1',
      'user-1',
    );

    expect(result).toEqual([]);
  });
});

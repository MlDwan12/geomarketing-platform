import { Repository } from 'typeorm';
import { RpcException } from '@nestjs/microservices';
import { CompetitorAnalysisReportService } from './competitor-analysis-report.service';
import { CompetitorAnalysisReport } from '../entities/competitor-analysis-report.entity';
import { CompanyAccessService } from '../../company/services/company-access.service';
import { Company } from '../../company/entities/company.entity';

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
    .mockImplementation((entity: Partial<CompetitorAnalysisReport>) => entity);
  const save = jest
    .fn()
    .mockImplementation((entity: Partial<CompetitorAnalysisReport>) => ({
      id: 'report-1',
      createdAt: new Date('2026-08-06T00:00:00Z'),
      textAnalysis: null,
      ...entity,
    }));
  const findOne = jest.fn();
  const find = jest.fn();
  const repo = {
    create,
    save,
    findOne,
    find,
  } as unknown as Repository<CompetitorAnalysisReport>;
  return { repo, create, save, findOne, find };
}

describe('CompetitorAnalysisReportService', () => {
  it('save() сохраняет отчёт после проверки доступа к бренду и компании', async () => {
    const access = fakeAccess({ id: 'company-1', brandId: 'brand-1' });
    const repo = fakeRepo();
    const service = new CompetitorAnalysisReportService(
      repo.repo,
      access.service,
    );

    const result = await service.save({
      companyId: 'company-1',
      brandId: 'brand-1',
      userId: 'user-1',
      competitors: [{ provider: '2gis', name: 'Кафе Х' }],
      cardComparison: { schedule: 'missing' },
      ratingComparison: { own: 4.2, avgCompetitor: 4.5 },
    });

    expect(access.assertBrandAccess).toHaveBeenCalledWith('brand-1', 'user-1');
    expect(access.getCompanyOrThrow).toHaveBeenCalledWith('company-1');
    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: 'company-1',
        competitors: [{ provider: '2gis', name: 'Кафе Х' }],
        cardComparison: { schedule: 'missing' },
        ratingComparison: { own: 4.2, avgCompetitor: 4.5 },
        textAnalysis: null,
      }),
    );
    expect(result.id).toBe('report-1');
  });

  it('save() бросает 404, если компания принадлежит другому бренду', async () => {
    const access = fakeAccess({ id: 'company-1', brandId: 'other-brand' });
    const repo = fakeRepo();
    const service = new CompetitorAnalysisReportService(
      repo.repo,
      access.service,
    );

    await expect(
      service.save({
        companyId: 'company-1',
        brandId: 'brand-1',
        userId: 'user-1',
        competitors: [],
        cardComparison: {},
        ratingComparison: {},
      }),
    ).rejects.toThrow(RpcException);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('getLatest() запрашивает одну последнюю запись по companyId, отсортированную по createdAt DESC', async () => {
    const access = fakeAccess({ id: 'company-1', brandId: 'brand-1' });
    const repo = fakeRepo();
    repo.findOne.mockResolvedValue({ id: 'report-latest' });
    const service = new CompetitorAnalysisReportService(
      repo.repo,
      access.service,
    );

    const result = await service.getLatest('company-1', 'brand-1', 'user-1');

    expect(repo.findOne).toHaveBeenCalledWith({
      where: { companyId: 'company-1' },
      order: { createdAt: 'DESC' },
    });
    expect(result).toEqual({ id: 'report-latest' });
  });

  it('listHistory() возвращает всю историю по companyId, отсортированную по createdAt DESC', async () => {
    const access = fakeAccess({ id: 'company-1', brandId: 'brand-1' });
    const repo = fakeRepo();
    repo.find.mockResolvedValue([{ id: 'r2' }, { id: 'r1' }]);
    const service = new CompetitorAnalysisReportService(
      repo.repo,
      access.service,
    );

    const result = await service.listHistory('company-1', 'brand-1', 'user-1');

    expect(repo.find).toHaveBeenCalledWith({
      where: { companyId: 'company-1' },
      order: { createdAt: 'DESC' },
    });
    expect(result).toEqual([{ id: 'r2' }, { id: 'r1' }]);
  });
});

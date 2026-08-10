import { Repository } from 'typeorm';
import { RpcException } from '@nestjs/microservices';
import { CompanyService } from './company.service';
import { CompanyAccessService } from './company-access.service';
import { Company, CompanyStatus } from '../entities/company.entity';
import { CompanyTemplate } from '../entities/company-template.entity';
import { CompanyGroup } from '../entities/company-group.entity';
import { BrandRole } from '../../brand/user-brand.entity';

const FORBIDDEN = new RpcException({ status: 403, message: 'Forbidden' });

function fakeAccess(
  company: Partial<Company> | null,
  assertBrandAccess: jest.Mock = jest.fn().mockResolvedValue(undefined),
) {
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

// Только зависимости, реально задействованные в проверяемых путях
// (delete/create/updateDefault до/после ролевой проверки) — остальные
// конструкторские параметры сервису не нужны в этих тестах.
function makeService(
  access: CompanyAccessService,
  companySave: jest.Mock = jest.fn().mockResolvedValue(undefined),
  templateRepo: Partial<Repository<CompanyTemplate>> = {},
  groupRepo: Partial<Repository<CompanyGroup>> = {},
) {
  const companyRepo = { save: companySave } as unknown as Repository<Company>;
  return new CompanyService(
    companyRepo,
    {} as never,
    templateRepo as Repository<CompanyTemplate>,
    {} as never,
    groupRepo as Repository<CompanyGroup>,
    {} as never,
    {} as never,
    access,
    {} as never,
    {} as never,
    {} as never,
  );
}

describe('CompanyService — ролевые проверки', () => {
  it('delete(): Owner может удалить компанию', async () => {
    const companySave = jest.fn().mockResolvedValue(undefined);
    const access = fakeAccess({ id: 'c1', brandId: 'brand-1' });
    const service = makeService(access.service, companySave);

    await service.delete('c1', 'user-1', 'brand-1');

    expect(access.assertBrandAccess).toHaveBeenCalledWith(
      'brand-1',
      'user-1',
      BrandRole.Owner,
    );
    expect(companySave).toHaveBeenCalledWith(
      expect.objectContaining({ status: CompanyStatus.Deleted }),
    );
  });

  it('delete(): Viewer/Manager без роли Owner получают 403, компания не трогается', async () => {
    const companySave = jest.fn();
    const access = fakeAccess(
      { id: 'c1', brandId: 'brand-1' },
      jest.fn().mockRejectedValue(FORBIDDEN),
    );
    const service = makeService(access.service, companySave);

    await expect(service.delete('c1', 'user-1', 'brand-1')).rejects.toThrow(
      RpcException,
    );
    expect(companySave).not.toHaveBeenCalled();
  });

  it('create(): требует минимум BrandRole.Manager', async () => {
    const access = fakeAccess(null, jest.fn().mockRejectedValue(FORBIDDEN));
    const service = makeService(access.service);

    await expect(
      service.create({ brandId: 'brand-1', userId: 'user-1', name: 'Кафе' }),
    ).rejects.toThrow(RpcException);
    expect(access.assertBrandAccess).toHaveBeenCalledWith(
      'brand-1',
      'user-1',
      BrandRole.Manager,
    );
  });

  it('create(): SEC-008 — отклоняет templateId из другого бренда', async () => {
    const access = fakeAccess(null);
    const templateRepo = {
      findOne: jest
        .fn()
        .mockResolvedValue({ id: 'tpl-1', brandId: 'other-brand' }),
    };
    const service = makeService(access.service, undefined, templateRepo);

    await expect(
      service.create({
        brandId: 'brand-1',
        userId: 'user-1',
        name: 'Кафе',
        templateId: 'tpl-1',
      }),
    ).rejects.toThrow(RpcException);
  });

  it('create(): SEC-008 — отклоняет groups[].id из другого бренда', async () => {
    const access = fakeAccess(null);
    const groupRepo = {
      // Группа существует, но не в этом бренде — find по {id, brandId} её не находит.
      find: jest.fn().mockResolvedValue([]),
    };
    const service = makeService(
      access.service,
      undefined,
      undefined,
      groupRepo,
    );

    await expect(
      service.create({
        brandId: 'brand-1',
        userId: 'user-1',
        name: 'Кафе',
        groups: [{ id: 'g1' }],
      }),
    ).rejects.toThrow(RpcException);
  });

  it('updateDefault(): требует минимум BrandRole.Manager', async () => {
    const access = fakeAccess(
      { id: 'c1', brandId: 'brand-1' },
      jest.fn().mockRejectedValue(FORBIDDEN),
    );
    const service = makeService(access.service);

    await expect(
      service.updateDefault('c1', 'user-1', {}, 'brand-1'),
    ).rejects.toThrow(RpcException);
    expect(access.assertBrandAccess).toHaveBeenCalledWith(
      'brand-1',
      'user-1',
      BrandRole.Manager,
    );
  });
});

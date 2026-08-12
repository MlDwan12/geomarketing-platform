import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RpcException } from '@nestjs/microservices';
import { TrackedKeyword } from '../entities/tracked-keyword.entity';
import { CompanyAccessService } from '../../company/services/company-access.service';
import { BrandRole } from '../../brand/user-brand.entity';

// Только CRUD ручных ключевых слов (коммит 1 плана
// docs/refactor-plans/position-checker.md) — сам расчёт позиции появится в
// следующих коммитах (integration-service) и будет читать этот список через
// POSITION_KEYWORDS_LIST.
@Injectable()
export class TrackedKeywordService {
  constructor(
    @InjectRepository(TrackedKeyword)
    private readonly keywordRepo: Repository<TrackedKeyword>,
    private readonly access: CompanyAccessService,
  ) {}

  async add(
    companyId: string,
    brandId: string,
    userId: string,
    keyword: string,
  ): Promise<TrackedKeyword> {
    await this.checkCompanyAccess(
      companyId,
      brandId,
      userId,
      BrandRole.Manager,
    );

    const existing = await this.keywordRepo.findOne({
      where: { companyId, keyword },
    });
    if (existing) return existing;

    return this.keywordRepo.save(
      this.keywordRepo.create({ companyId, keyword }),
    );
  }

  async remove(
    companyId: string,
    brandId: string,
    userId: string,
    keyword: string,
  ): Promise<void> {
    await this.checkCompanyAccess(
      companyId,
      brandId,
      userId,
      BrandRole.Manager,
    );

    await this.keywordRepo.delete({ companyId, keyword });
  }

  async listForCompany(
    companyId: string,
    brandId: string,
    userId: string,
  ): Promise<TrackedKeyword[]> {
    await this.checkCompanyAccess(companyId, brandId, userId);

    return this.keywordRepo.find({
      where: { companyId },
      order: { createdAt: 'ASC' },
    });
  }

  private async checkCompanyAccess(
    companyId: string,
    brandId: string,
    userId: string,
    minRole: BrandRole = BrandRole.Viewer,
  ): Promise<void> {
    await this.access.assertBrandAccess(brandId, userId, minRole);
    const company = await this.access.getCompanyOrThrow(companyId);

    if (company.brandId !== brandId) {
      throw new RpcException({ status: 404, message: 'Company not found' });
    }
  }
}

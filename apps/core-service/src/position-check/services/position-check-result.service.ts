import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RpcException } from '@nestjs/microservices';
import { PositionCheckResult } from '../entities/position-check-result.entity';
import { CompanyAccessService } from '../../company/services/company-access.service';
import { BrandRole } from '../../brand/user-brand.entity';

export interface PositionCheckResultInput {
  keyword: string;
  source: 'auto' | 'manual';
  provider: '2gis' | 'yandex';
  position: number | null;
}

// Только хранение и чтение истории PositionCheckResult (коммит 2 плана
// docs/refactor-plans/position-checker.md) — сам расчёт позиции появится в
// следующих коммитах (integration-service) и будет вызывать save() с уже
// готовыми результатами.
@Injectable()
export class PositionCheckResultService {
  constructor(
    @InjectRepository(PositionCheckResult)
    private readonly resultRepo: Repository<PositionCheckResult>,
    private readonly access: CompanyAccessService,
  ) {}

  async save(
    companyId: string,
    brandId: string,
    userId: string,
    results: PositionCheckResultInput[],
  ): Promise<PositionCheckResult[]> {
    await this.checkCompanyAccess(
      companyId,
      brandId,
      userId,
      BrandRole.Manager,
    );

    if (!results.length) return [];

    const entities = results.map((r) =>
      this.resultRepo.create({ companyId, ...r }),
    );
    return this.resultRepo.save(entities);
  }

  async history(
    companyId: string,
    brandId: string,
    userId: string,
    keyword?: string,
  ): Promise<PositionCheckResult[]> {
    await this.checkCompanyAccess(companyId, brandId, userId);

    return this.resultRepo.find({
      where: keyword ? { companyId, keyword } : { companyId },
      order: { checkedAt: 'DESC' },
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

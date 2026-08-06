import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RpcException } from '@nestjs/microservices';
import { CompetitorAnalysisReport } from '../entities/competitor-analysis-report.entity';
import { CompanyAccessService } from '../../company/services/company-access.service';

// Только хранение и чтение истории CompetitorAnalysisReport (коммит 1 плана
// docs/refactor-plans/competitor-analysis-report.md) — поиск конкурентов,
// скрапинг отзывов и AI-анализ появятся в следующих коммитах и будут вызывать
// save() с уже готовым результатом.
@Injectable()
export class CompetitorAnalysisReportService {
  constructor(
    @InjectRepository(CompetitorAnalysisReport)
    private readonly reportRepo: Repository<CompetitorAnalysisReport>,
    private readonly access: CompanyAccessService,
  ) {}

  async save(dto: {
    companyId: string;
    brandId: string;
    userId: string;
    competitors: unknown[];
    cardComparison: Record<string, unknown>;
    ratingComparison: Record<string, unknown>;
    textAnalysis?: Record<string, unknown> | null;
  }): Promise<CompetitorAnalysisReport> {
    await this.checkCompanyAccess(dto.companyId, dto.brandId, dto.userId);

    return this.reportRepo.save(
      this.reportRepo.create({
        companyId: dto.companyId,
        competitors: dto.competitors,
        cardComparison: dto.cardComparison,
        ratingComparison: dto.ratingComparison,
        textAnalysis: dto.textAnalysis ?? null,
      }),
    );
  }

  async getLatest(
    companyId: string,
    brandId: string,
    userId: string,
  ): Promise<CompetitorAnalysisReport | null> {
    await this.checkCompanyAccess(companyId, brandId, userId);

    return this.reportRepo.findOne({
      where: { companyId },
      order: { createdAt: 'DESC' },
    });
  }

  async listHistory(
    companyId: string,
    brandId: string,
    userId: string,
  ): Promise<CompetitorAnalysisReport[]> {
    await this.checkCompanyAccess(companyId, brandId, userId);

    return this.reportRepo.find({
      where: { companyId },
      order: { createdAt: 'DESC' },
    });
  }

  private async checkCompanyAccess(
    companyId: string,
    brandId: string,
    userId: string,
  ): Promise<void> {
    await this.access.assertBrandAccess(brandId, userId);
    const company = await this.access.getCompanyOrThrow(companyId);

    if (company.brandId !== brandId) {
      throw new RpcException({ status: 404, message: 'Company not found' });
    }
  }
}

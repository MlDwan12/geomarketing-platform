import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { Patterns } from '@geo/contracts';
import { sendRpc } from '../common/send-rpc';
import { ReviewListService } from './review-list.service';
import { ReviewAggregates } from './review-aggregates';

// Проекция COMPANY_LIST_FOR_VISIBILITY (company.service.ts#listForVisibility) —
// нам из неё нужны только id/name, addressDisplay/coordinates не используем.
type CompanyRef = { id: string; name: string };

export type BrandDashboardCompanyResult = {
  companyId: string;
  companyName: string;
  aggregates: ReviewAggregates;
  error?: string;
};

export type BrandDashboardResult = {
  companies: BrandDashboardCompanyResult[];
  totalUnanswered: number;
};

const EMPTY_AGGREGATES: ReviewAggregates = {
  combined: { total: 0, unanswered: 0, averageRating: null },
  yandex: { total: 0, unanswered: 0, averageRating: null },
  twogis: { total: 0, unanswered: 0, averageRating: null },
};

// Сеть в 50 точек — ограничиваем параллелизм чтения, тот же принцип, что
// MapVisibilityService.checkVisibility в integration-service.
const CONCURRENCY = 5;

@Injectable()
export class ReviewBrandDashboardService {
  constructor(
    @Inject('CORE_SERVICE') private readonly coreServiceClient: ClientProxy,
    private readonly reviewListService: ReviewListService,
  ) {}

  async getBrandDashboard(
    brandId: string,
    userId: string,
  ): Promise<BrandDashboardResult> {
    const companies = await sendRpc<CompanyRef[]>(
      this.coreServiceClient,
      Patterns.COMPANY_LIST_FOR_VISIBILITY,
      { brandId, userId },
    );

    const results: BrandDashboardCompanyResult[] = [];

    for (let i = 0; i < companies.length; i += CONCURRENCY) {
      const batch = companies.slice(i, i + CONCURRENCY);
      const batchResults = await Promise.all(
        batch.map((company) => this.getOne(company)),
      );
      results.push(...batchResults);
    }

    const totalUnanswered = results.reduce(
      (sum, r) => sum + r.aggregates.combined.unanswered,
      0,
    );

    return { companies: results, totalUnanswered };
  }

  private async getOne(
    company: CompanyRef,
  ): Promise<BrandDashboardCompanyResult> {
    try {
      const { aggregates } = await this.reviewListService.listForCompany(
        company.id,
      );
      return { companyId: company.id, companyName: company.name, aggregates };
    } catch (error) {
      return {
        companyId: company.id,
        companyName: company.name,
        aggregates: EMPTY_AGGREGATES,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

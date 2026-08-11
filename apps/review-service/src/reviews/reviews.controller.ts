import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { Patterns } from '@geo/contracts';
import { ReviewRefreshService } from './review-refresh.service';
import { ReviewListService } from './review-list.service';

@Controller()
export class ReviewsController {
  constructor(
    private readonly reviewRefreshService: ReviewRefreshService,
    private readonly reviewListService: ReviewListService,
  ) {}

  @MessagePattern(Patterns.REVIEW_REFRESH_COMPANY)
  refreshCompany(
    @Payload()
    payload: {
      companyId: string;
      brandId: string;
      userId: string;
    },
  ) {
    return this.reviewRefreshService.refreshCompany(
      payload.companyId,
      payload.brandId,
      payload.userId,
    );
  }

  @MessagePattern(Patterns.REVIEW_LIST_FOR_COMPANY)
  listForCompany(@Payload() payload: { companyId: string }) {
    return this.reviewListService.listForCompany(payload.companyId);
  }
}

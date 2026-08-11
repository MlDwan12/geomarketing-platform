import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { Patterns } from '@geo/contracts';
import { ReviewRefreshService } from './review-refresh.service';

@Controller()
export class ReviewsController {
  constructor(private readonly reviewRefreshService: ReviewRefreshService) {}

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
}

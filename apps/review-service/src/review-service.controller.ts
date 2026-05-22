import { Controller, Get } from '@nestjs/common';
import { ReviewServiceService } from './review-service.service';

@Controller()
export class ReviewServiceController {
  constructor(private readonly reviewServiceService: ReviewServiceService) {}

  @Get()
  getHello(): string {
    return this.reviewServiceService.getHello();
  }
}

import { Controller, Get } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { ReviewServiceService } from './review-service.service';

@Controller()
export class ReviewServiceController {
  constructor(private readonly reviewServiceService: ReviewServiceService) {}

  @Get()
  getHello(): string {
    return this.reviewServiceService.getHello();
  }

  @MessagePattern('review.ping')
  ping() {
    return {
      service: 'review-service',
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}

import { Module } from '@nestjs/common';
import { ReviewServiceController } from './review-service.controller';
import { ReviewServiceService } from './review-service.service';
import { AppConfigModule } from '@geo/config';

@Module({
  imports: [AppConfigModule],
  controllers: [ReviewServiceController],
  providers: [ReviewServiceService],
})
export class ReviewServiceModule {}

import { Module } from '@nestjs/common';
import { ReviewServiceController } from './review-service.controller';
import { ReviewServiceService } from './review-service.service';
import { AppConfigModule } from '@geo/config';
import { MapParserClientService } from './map-parser-client/map-parser-client.service';

@Module({
  imports: [AppConfigModule],
  controllers: [ReviewServiceController],
  providers: [ReviewServiceService, MapParserClientService],
})
export class ReviewServiceModule {}

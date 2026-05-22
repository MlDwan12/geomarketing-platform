import { Module } from '@nestjs/common';
import { AiServiceController } from './ai-service.controller';
import { AiServiceService } from './ai-service.service';
import { AppConfigModule } from '@geo/config';

@Module({
  imports: [AppConfigModule],
  controllers: [AiServiceController],
  providers: [AiServiceService],
})
export class AiServiceModule {}

import { Module } from '@nestjs/common';
import { CoreServiceController } from './core-service.controller';
import { CoreServiceService } from './core-service.service';
import { AppConfigModule } from '@geo/config';

@Module({
  imports: [AppConfigModule],
  controllers: [CoreServiceController],
  providers: [CoreServiceService],
})
export class CoreServiceModule {}

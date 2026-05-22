import { Module } from '@nestjs/common';
import { IntegrationServiceController } from './integration-service.controller';
import { IntegrationServiceService } from './integration-service.service';
import { AppConfigModule } from '@geo/config';

@Module({
  imports: [AppConfigModule],
  controllers: [IntegrationServiceController],
  providers: [IntegrationServiceService],
})
export class IntegrationServiceModule {}

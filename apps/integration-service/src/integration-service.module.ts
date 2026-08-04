import { Module } from '@nestjs/common';
import { IntegrationServiceController } from './integration-service.controller';
import { IntegrationServiceService } from './integration-service.service';
import { AppConfigModule } from '@geo/config';
import { TwoGisModule } from './two-gis/two-gis.module';

@Module({
  imports: [AppConfigModule, TwoGisModule],
  controllers: [IntegrationServiceController],
  providers: [IntegrationServiceService],
})
export class IntegrationServiceModule {}

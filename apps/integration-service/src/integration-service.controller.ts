import { Controller, Get } from '@nestjs/common';
import { IntegrationServiceService } from './integration-service.service';

@Controller()
export class IntegrationServiceController {
  constructor(private readonly integrationServiceService: IntegrationServiceService) {}

  @Get()
  getHello(): string {
    return this.integrationServiceService.getHello();
  }
}

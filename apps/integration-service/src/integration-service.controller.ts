import { Controller, Get } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { IntegrationServiceService } from './integration-service.service';

@Controller()
export class IntegrationServiceController {
  constructor(private readonly integrationServiceService: IntegrationServiceService) {}

  @Get()
  getHello(): string {
    return this.integrationServiceService.getHello();
  }

  @MessagePattern('integration.ping')
  ping() {
    return {
      service: 'integration-service',
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}

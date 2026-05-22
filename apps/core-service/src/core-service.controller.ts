import { Controller, Get } from '@nestjs/common';
import { CoreServiceService } from './core-service.service';
import { MessagePattern } from '@nestjs/microservices';

@Controller()
export class CoreServiceController {
  constructor(private readonly coreServiceService: CoreServiceService) {}

  @Get()
  getHello(): string {
    return this.coreServiceService.getHello();
  }

  @MessagePattern('core.ping')
  ping() {
    return {
      service: 'core-service',
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}

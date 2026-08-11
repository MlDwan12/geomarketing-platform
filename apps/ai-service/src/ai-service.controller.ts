import { Controller, Get } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { AiServiceService } from './ai-service.service';

@Controller()
export class AiServiceController {
  constructor(private readonly aiServiceService: AiServiceService) {}

  @Get()
  getHello(): string {
    return this.aiServiceService.getHello();
  }

  @MessagePattern('ai.ping')
  ping() {
    return {
      service: 'ai-service',
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}

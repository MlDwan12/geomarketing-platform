import { Controller, Get, Inject } from '@nestjs/common';
import { ApiGatewayService } from './api-gateway.service';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';

@Controller()
export class ApiGatewayController {
  constructor(
    private readonly apiGatewayService: ApiGatewayService,
    @Inject('CORE_SERVICE')
    private readonly coreClient: ClientProxy,
  ) {}

  @Get()
  getHello(): string {
    return this.apiGatewayService.getHello();
  }

  @Get('health/core')
  async checkCore() {
    return firstValueFrom(
      this.coreClient.send('core.ping', {}).pipe(timeout(3000)),
    );
  }
}

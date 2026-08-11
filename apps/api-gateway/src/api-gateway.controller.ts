import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiGatewayService } from './api-gateway.service';
import { ClientProxy } from '@nestjs/microservices';
import { sendRpc } from './common/rpc';
import { CorePingResponseDto } from './dto/core-ping-response.dto';
import { HealthService } from './health/health.service';
import { AggregateHealthDto } from './health/dto/health-response.dto';

@ApiTags('health')
@Controller()
export class ApiGatewayController {
  constructor(
    private readonly apiGatewayService: ApiGatewayService,
    private readonly healthService: HealthService,
    @Inject('CORE_SERVICE')
    private readonly coreClient: ClientProxy,
  ) {}

  @ApiOperation({ summary: 'Заглушка на корне ("Hello World")' })
  @ApiResponse({ status: 200, type: String })
  @Get()
  getHello(): string {
    return this.apiGatewayService.getHello();
  }

  @ApiOperation({
    summary: 'Проверить доступность core-service через RabbitMQ',
  })
  @ApiResponse({ status: 200, type: CorePingResponseDto })
  @Get('health/core')
  async checkCore() {
    return sendRpc(this.coreClient, 'core.ping', {}, 3000);
  }

  @ApiOperation({
    summary: 'Агрегированный health-check всех микросервисов',
    description:
      'Пингует core/integration/ai/review-service через RabbitMQ и ' +
      'map-parser через HTTP (единственный не-RMQ сервис). status: ' +
      '"degraded", если хотя бы один недоступен — смотри services для ' +
      'деталей по каждому.',
  })
  @ApiResponse({ status: 200, type: AggregateHealthDto })
  @Get('health')
  async checkAll() {
    return this.healthService.checkAll();
  }
}

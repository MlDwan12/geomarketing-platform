import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiGatewayService } from './api-gateway.service';
import { ClientProxy } from '@nestjs/microservices';
import { sendRpc } from './common/rpc';
import { CorePingResponseDto } from './dto/core-ping-response.dto';

@ApiTags('health')
@Controller()
export class ApiGatewayController {
  constructor(
    private readonly apiGatewayService: ApiGatewayService,
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
}

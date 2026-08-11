import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';
import { sendRpc } from '../common/rpc';

// Общий таймаут на все 5 проверок — health-check не должен сам зависать
// на недоступном сервисе (см. ApiGatewayController.checkCore(), который уже
// использовал 3000мс для core-service).
const HEALTH_CHECK_TIMEOUT = 3000;

export interface ServiceHealth {
  status: 'ok' | 'error';
  error?: string;
}

export interface AggregateHealth {
  status: 'ok' | 'degraded';
  services: {
    core: ServiceHealth;
    integration: ServiceHealth;
    ai: ServiceHealth;
    review: ServiceHealth;
    mapParser: ServiceHealth;
  };
}

// GET /health — единственная проверка, которая раньше существовала
// (GET /health/core, см. ApiGatewayController), покрывала только
// core-service. integration-service/ai-service/map-parser не поднимались
// в этой сессии молча — их пришлось диагностировать вручную через
// ps/fuser. Не убирает /health/core (узкая проверка остаётся полезной),
// а добавляет агрегированную поверх всех 5 сервисов.
@Injectable()
export class HealthService {
  private readonly mapParserUrl: string;
  private readonly mapParserInternalToken: string;

  constructor(
    @Inject('CORE_SERVICE') private readonly coreClient: ClientProxy,
    @Inject('INTEGRATION_SERVICE')
    private readonly integrationClient: ClientProxy,
    @Inject('AI_SERVICE') private readonly aiClient: ClientProxy,
    @Inject('REVIEW_SERVICE') private readonly reviewClient: ClientProxy,
    private readonly config: ConfigService,
  ) {
    this.mapParserUrl =
      this.config.get<string>('MAP_PARSER_URL') ?? 'http://geo-map-parser:3005';
    this.mapParserInternalToken =
      this.config.get<string>('MAP_PARSER_INTERNAL_TOKEN') ?? '';
  }

  async checkAll(): Promise<AggregateHealth> {
    const [core, integration, ai, review, mapParser] = await Promise.all([
      this.pingRpc(this.coreClient, 'core.ping'),
      this.pingRpc(this.integrationClient, 'integration.ping'),
      this.pingRpc(this.aiClient, 'ai.ping'),
      this.pingRpc(this.reviewClient, 'review.ping'),
      this.pingMapParser(),
    ]);

    const services = { core, integration, ai, review, mapParser };
    const allOk = Object.values(services).every((s) => s.status === 'ok');

    return { status: allOk ? 'ok' : 'degraded', services };
  }

  private async pingRpc(
    client: ClientProxy,
    pattern: string,
  ): Promise<ServiceHealth> {
    try {
      await sendRpc(client, pattern, {}, HEALTH_CHECK_TIMEOUT);
      return { status: 'ok' };
    } catch (err) {
      return { status: 'error', error: this.errorMessage(err) };
    }
  }

  private async pingMapParser(): Promise<ServiceHealth> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT);

    try {
      const res = await fetch(`${this.mapParserUrl}/parser/ping`, {
        headers: { 'X-Internal-Token': this.mapParserInternalToken },
        signal: controller.signal,
      });

      if (!res.ok) {
        return { status: 'error', error: `HTTP ${res.status}` };
      }

      return { status: 'ok' };
    } catch (err) {
      return { status: 'error', error: this.errorMessage(err) };
    } finally {
      clearTimeout(timer);
    }
  }

  private errorMessage(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
  }
}

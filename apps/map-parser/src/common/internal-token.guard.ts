import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

// SEC-009: map-parser не сидит за RabbitMQ как остальные внутренние сервисы —
// api-gateway вызывает его напрямую по HTTP (TwoGisImportController,
// CompetitorReviewsFetcherService). Порт наружу не публикуется (см.
// docker-compose.yml), но внутри geo-net любой контейнер мог бы достучаться
// без этого guard'а — здесь минимальная защита "запрос от api-gateway",
// не полноценная авторизация.
@Injectable()
export class InternalTokenGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const expected = this.config.get<string>('MAP_PARSER_INTERNAL_TOKEN');
    const provided = request.headers['x-internal-token'];

    if (!expected || provided !== expected) {
      throw new UnauthorizedException('Invalid or missing internal token');
    }

    return true;
  }
}

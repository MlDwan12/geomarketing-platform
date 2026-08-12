import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

// Защита служебных операций, не привязанных к пользовательской сессии/бренду
// (см. docs/refactor-plans/position-checker-retention.md) — по образцу
// apps/map-parser/src/common/internal-token.guard.ts, но app-local: у
// каждого приложения свой env-токен, не общий (см. POSITION_CHECK_CLEANUP_TOKEN).
@Injectable()
export class InternalTokenGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const expected = this.config.get<string>('POSITION_CHECK_CLEANUP_TOKEN');
    const provided = request.headers['x-internal-token'];

    if (!expected || provided !== expected) {
      throw new UnauthorizedException('Invalid or missing internal token');
    }

    return true;
  }
}

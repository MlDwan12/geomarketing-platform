import { CanActivate, ExecutionContext, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';

@Injectable()
export class SessionGuard implements CanActivate {
  private readonly logger = new Logger(SessionGuard.name);

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    if (req.method === 'OPTIONS') return true;

    this.logger.debug(`[${req.method}] ${req.url} | sessionID=${req.sessionID} | userId=${req.session?.userId ?? 'none'} | cookie=${req.headers.cookie ?? 'none'}`);

    if (!req.session?.userId) {
      throw new UnauthorizedException('Сессия не найдена или истекла');
    }
    return true;
  }
}

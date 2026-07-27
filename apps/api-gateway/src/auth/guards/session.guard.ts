import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';

@Injectable()
export class SessionGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    if (req.method === 'OPTIONS') return true;

    if (!req.session?.userId) {
      throw new UnauthorizedException('Сессия не найдена или истекла');
    }
    return true;
  }
}

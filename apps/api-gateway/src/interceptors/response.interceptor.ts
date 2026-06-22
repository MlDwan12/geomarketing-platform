import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Request } from 'express';

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest<Request>();
    const tz = (req.headers['x-timezone'] as string) || 'UTC';

    return next.handle().pipe(
      map((data) => ({ success: true, data: this.formatDates(data, tz) })),
    );
  }

  private formatDates(value: unknown, tz: string): unknown {
    if (value instanceof Date) return toTzIso(value, tz);
    if (typeof value === 'string' && ISO_DATE_RE.test(value)) return toTzIso(new Date(value), tz);
    if (Array.isArray(value)) return value.map((v) => this.formatDates(v, tz));
    if (value !== null && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, this.formatDates(v, tz)]),
      );
    }
    return value;
  }
}

function toTzIso(date: Date, tz: string): string {
  try {
    const local = new Date(date.toLocaleString('en-US', { timeZone: tz }));
    const utc = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
    const offsetMs = local.getTime() - utc.getTime();
    const sign = offsetMs >= 0 ? '+' : '-';
    const abs = Math.abs(offsetMs);
    const hh = String(Math.floor(abs / 3600000)).padStart(2, '0');
    const mm = String(Math.floor((abs % 3600000) / 60000)).padStart(2, '0');
    const shifted = new Date(date.getTime() + offsetMs);
    return shifted.toISOString().replace('Z', `${sign}${hh}:${mm}`);
  } catch {
    return date.toISOString();
  }
}

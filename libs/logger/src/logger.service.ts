import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';

type Level = 'log' | 'error' | 'warn' | 'debug' | 'verbose';

// Структурный логгер: одна JSON-строка на запись, без внешних зависимостей.
// Реализует интерфейс LoggerService из @nestjs/common — можно подключать
// и через DI, и через app.useLogger(...) при бутстрапе.
@Injectable()
export class LoggerService implements NestLoggerService {
  log(message: unknown, ...optionalParams: unknown[]): void {
    this.write('log', message, optionalParams);
  }

  error(message: unknown, ...optionalParams: unknown[]): void {
    this.write('error', message, optionalParams);
  }

  warn(message: unknown, ...optionalParams: unknown[]): void {
    this.write('warn', message, optionalParams);
  }

  debug(message: unknown, ...optionalParams: unknown[]): void {
    this.write('debug', message, optionalParams);
  }

  verbose(message: unknown, ...optionalParams: unknown[]): void {
    this.write('verbose', message, optionalParams);
  }

  private write(
    level: Level,
    message: unknown,
    optionalParams: unknown[],
  ): void {
    const rest = [...optionalParams];

    // Соглашение Nest: если последний параметр — строка, это context
    // (например `logger.log('started', 'Bootstrap')`).
    let context: string | undefined;
    if (rest.length && typeof rest[rest.length - 1] === 'string') {
      context = rest.pop() as string;
    }

    // Остальные параметры — структурные метаданные (объекты подмешиваются
    // в запись целиком) либо доп. значения (например trace-строка Nest
    // в `error(message, trace, context)`).
    const meta: Record<string, unknown> = {};
    for (const param of rest) {
      if (param instanceof Error) {
        meta['stack'] = param.stack;
      } else if (param && typeof param === 'object') {
        Object.assign(meta, param);
      } else {
        meta['trace'] = param;
      }
    }

    if (message instanceof Error && message.stack !== undefined) {
      meta['stack'] = message.stack;
    }

    const record: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
      level,
      ...(context !== undefined ? { context } : {}),
      message: this.formatMessage(message),
      ...meta,
    };

    const line = JSON.stringify(record);
    if (level === 'error') {
      process.stderr.write(line + '\n');
    } else {
      process.stdout.write(line + '\n');
    }
  }

  private formatMessage(message: unknown): string {
    if (message instanceof Error) return message.message;
    if (typeof message === 'string') return message;
    try {
      return JSON.stringify(message);
    } catch {
      return String(message);
    }
  }
}

import { IsEnum, IsNotEmpty, IsNumberString, IsOptional, IsString } from 'class-validator';

export enum NodeEnv {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

export class EnvValidationSchema {
  @IsEnum(NodeEnv)
  NODE_ENV!: NodeEnv;

  // ── Shared ────────────────────────────────────────────────────────────────
  @IsString()
  @IsNotEmpty()
  RABBITMQ_URL!: string;

  // ── api-gateway ───────────────────────────────────────────────────────────
  @IsOptional()
  @IsNumberString()
  API_GATEWAY_PORT?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  DATABASE_URL?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  SESSION_SECRET?: string;

  @IsOptional()
  @IsString()
  REDIS_HOST?: string;

  @IsOptional()
  @IsNumberString()
  REDIS_PORT?: string;

  // ── core-service ──────────────────────────────────────────────────────────
  @IsOptional()
  @IsNumberString()
  CORE_SERVICE_PORT?: string;
}

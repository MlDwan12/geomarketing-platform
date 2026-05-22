import { IsEnum, IsNotEmpty, IsNumberString, IsString } from 'class-validator';

export enum NodeEnv {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

export class EnvValidationSchema {
  @IsEnum(NodeEnv)
  NODE_ENV!: NodeEnv;

  @IsNumberString()
  API_GATEWAY_PORT!: string;

  @IsString()
  @IsNotEmpty()
  DATABASE_URL!: string;

  @IsString()
  @IsNotEmpty()
  RABBITMQ_URL!: string;

  @IsString()
  @IsNotEmpty()
  REDIS_HOST!: string;

  @IsNumberString()
  REDIS_PORT!: string;

  @IsString()
  @IsNotEmpty()
  JWT_ACCESS_SECRET!: string;

  @IsString()
  @IsNotEmpty()
  JWT_REFRESH_SECRET!: string;
}

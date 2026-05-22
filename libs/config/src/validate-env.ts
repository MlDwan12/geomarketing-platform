import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { EnvValidationSchema } from './env.validation';

export function validateEnv(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvValidationSchema, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }

  return validatedConfig;
}

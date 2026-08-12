import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client } from '@aws-sdk/client-s3';

export const S3_CLIENT = 'S3_CLIENT';

// Отдельный DI-провайдер (не конструируется внутри
// PositionCheckArchiveStoreService) — тот же принцип, что ClientProxy для
// RMQ в api-gateway (см. position-check.module.ts там же), позволяет в
// тестах подменить весь S3Client моком { send: jest.fn() } без реального
// сетевого клиента. ConfigService доступен без явного imports — AppConfigModule
// зарегистрирован с isGlobal: true (см. libs/config/src/config.module.ts).
export const s3ClientProvider: Provider = {
  provide: S3_CLIENT,
  inject: [ConfigService],
  useFactory: (config: ConfigService) =>
    new S3Client({
      endpoint: config.get<string>('S3_ENDPOINT'),
      region: config.get<string>('S3_REGION') ?? 'us-east-1',
      forcePathStyle: config.get<string>('S3_FORCE_PATH_STYLE') === 'true',
      credentials: {
        accessKeyId: config.get<string>('S3_ACCESS_KEY_ID') ?? '',
        secretAccessKey: config.get<string>('S3_SECRET_ACCESS_KEY') ?? '',
      },
    }),
};

import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { promisify } from 'util';
import { gunzip, gzip } from 'zlib';
import { S3_CLIENT } from './s3-client.provider';

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

const ARCHIVE_PREFIX = 'position-check-archive';

export interface ArchivedPositionCheckRecord {
  id: string;
  companyId: string;
  keyword: string;
  source: 'auto' | 'manual';
  provider: '2gis' | 'yandex';
  position: number | null;
  checkedAt: string;
}

// Хранилище архива истории Чекера позиций в MinIO/S3 (см.
// docs/refactor-plans/position-checker-retention.md, коммит 2). NDJSON+gzip,
// один объект на companyId за один прогон очистки — S3 не поддерживает
// эффективный append, поэтому каждый прогон создаёт новый объект-инкремент,
// не переписывает существующий.
@Injectable()
export class PositionCheckArchiveStoreService {
  private readonly bucket: string;
  private bucketEnsured = false;

  constructor(
    @Inject(S3_CLIENT) private readonly client: S3Client,
    config: ConfigService,
  ) {
    this.bucket = config.get<string>('S3_BUCKET') ?? 'position-check-archive';
  }

  async putArchive(
    companyId: string,
    runTimestamp: Date,
    records: ArchivedPositionCheckRecord[],
  ): Promise<void> {
    await this.ensureBucket();

    const ndjson = records.map((r) => JSON.stringify(r)).join('\n');
    const body = await gzipAsync(Buffer.from(ndjson, 'utf-8'));

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: this.archiveKey(companyId, runTimestamp),
        Body: body,
        ContentType: 'application/x-ndjson',
        ContentEncoding: 'gzip',
      }),
    );
  }

  async listArchiveKeys(companyId: string): Promise<string[]> {
    await this.ensureBucket();

    const prefix = `${ARCHIVE_PREFIX}/${companyId}/`;
    const keys: string[] = [];
    let continuationToken: string | undefined;

    do {
      const result = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        }),
      );

      for (const obj of result.Contents ?? []) {
        if (obj.Key) keys.push(obj.Key);
      }

      continuationToken = result.IsTruncated
        ? result.NextContinuationToken
        : undefined;
    } while (continuationToken);

    return keys;
  }

  async getArchiveRecords(key: string): Promise<ArchivedPositionCheckRecord[]> {
    const result = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );

    if (!result.Body) {
      throw new Error(`Archive object ${key} has no body`);
    }

    const compressed = Buffer.from(await result.Body.transformToByteArray());
    const decompressed = await gunzipAsync(compressed);

    return decompressed
      .toString('utf-8')
      .split('\n')
      .filter((line) => line.length > 0)
      .map((line) => JSON.parse(line) as ArchivedPositionCheckRecord);
  }

  private archiveKey(companyId: string, runTimestamp: Date): string {
    return `${ARCHIVE_PREFIX}/${companyId}/${runTimestamp.toISOString()}.ndjson.gz`;
  }

  // Ленивая идемпотентная проверка/создание бакета — та же причина, что у
  // resolveDefaultTimeout() в apps/api-gateway/src/common/rpc.ts: на момент
  // конструирования сервиса нельзя быть уверенным, что делать сетевой запрос
  // безопасно/нужно сразу, откладываем до первого реального использования.
  private async ensureBucket(): Promise<void> {
    if (this.bucketEnsured) return;

    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch (err) {
      const statusCode = (err as { $metadata?: { httpStatusCode?: number } })
        ?.$metadata?.httpStatusCode;
      if (statusCode !== 404) throw err;
      await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
    }

    this.bucketEnsured = true;
  }
}

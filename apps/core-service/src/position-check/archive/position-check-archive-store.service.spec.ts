import { ConfigService } from '@nestjs/config';
import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { gunzipSync, gzipSync } from 'zlib';
import {
  ArchivedPositionCheckRecord,
  PositionCheckArchiveStoreService,
} from './position-check-archive-store.service';

function fakeConfig(bucket = 'position-check-archive') {
  return {
    get: jest.fn((key: string) => (key === 'S3_BUCKET' ? bucket : undefined)),
  } as unknown as ConfigService;
}

// Реальные ошибки AWS SDK v3 — это Error-подклассы с $metadata.httpStatusCode,
// а не голые объекты — мок должен соответствовать форме, которую код реально
// проверяет (err.$metadata?.httpStatusCode).
function fakeAwsError(httpStatusCode: number): Error & {
  $metadata: { httpStatusCode: number };
} {
  return Object.assign(new Error(`AWS error ${httpStatusCode}`), {
    $metadata: { httpStatusCode },
  });
}

const record: ArchivedPositionCheckRecord = {
  id: 'r1',
  companyId: 'company-1',
  keyword: 'кофейня',
  source: 'manual',
  provider: '2gis',
  position: 3,
  checkedAt: '2026-01-01T00:00:00.000Z',
};

describe('PositionCheckArchiveStoreService.putArchive', () => {
  it('бакет уже существует — PutObjectCommand с gzip-сжатым NDJSON по правильному ключу', async () => {
    const send = jest.fn((command: unknown) => {
      if (command instanceof HeadBucketCommand) return Promise.resolve({});
      if (command instanceof PutObjectCommand) return Promise.resolve({});
      throw new Error('unexpected command');
    });
    const client = { send } as unknown as S3Client;
    const store = new PositionCheckArchiveStoreService(client, fakeConfig());

    await store.putArchive('company-1', new Date('2026-01-02T03:04:05.000Z'), [
      record,
    ]);

    const putCall = send.mock.calls.find(
      (call) => call[0] instanceof PutObjectCommand,
    )?.[0] as PutObjectCommand;
    expect(putCall.input.Bucket).toBe('position-check-archive');
    expect(putCall.input.Key).toBe(
      'position-check-archive/company-1/2026-01-02T03:04:05.000Z.ndjson.gz',
    );
    const decompressed = gunzipSync(putCall.input.Body as Buffer).toString(
      'utf-8',
    );
    expect(decompressed).toBe(JSON.stringify(record));
  });

  it('бакета нет (HeadBucket 404) — создаётся перед загрузкой', async () => {
    const send = jest.fn((command: unknown) => {
      if (command instanceof HeadBucketCommand) {
        return Promise.reject(fakeAwsError(404));
      }
      if (command instanceof CreateBucketCommand) return Promise.resolve({});
      if (command instanceof PutObjectCommand) return Promise.resolve({});
      throw new Error('unexpected command');
    });
    const client = { send } as unknown as S3Client;
    const store = new PositionCheckArchiveStoreService(client, fakeConfig());

    await store.putArchive('company-1', new Date(), [record]);

    expect(
      send.mock.calls.some((call) => call[0] instanceof CreateBucketCommand),
    ).toBe(true);
  });

  it('HeadBucket падает НЕ с 404 — ошибка пробрасывается, бакет не создаётся', async () => {
    const send = jest.fn((command: unknown) => {
      if (command instanceof HeadBucketCommand) {
        return Promise.reject(fakeAwsError(500));
      }
      throw new Error('unexpected command');
    });
    const client = { send } as unknown as S3Client;
    const store = new PositionCheckArchiveStoreService(client, fakeConfig());

    await expect(
      store.putArchive('company-1', new Date(), [record]),
    ).rejects.toThrow('AWS error 500');
    expect(
      send.mock.calls.some((call) => call[0] instanceof CreateBucketCommand),
    ).toBe(false);
  });
});

describe('PositionCheckArchiveStoreService.listArchiveKeys', () => {
  it('листит ключи под префиксом companyId с пагинацией (ContinuationToken)', async () => {
    const send = jest.fn((command: unknown) => {
      if (command instanceof HeadBucketCommand) return Promise.resolve({});
      if (command instanceof ListObjectsV2Command) {
        if (!command.input.ContinuationToken) {
          return Promise.resolve({
            Contents: [{ Key: 'position-check-archive/company-1/a.ndjson.gz' }],
            IsTruncated: true,
            NextContinuationToken: 'token-2',
          });
        }
        return Promise.resolve({
          Contents: [{ Key: 'position-check-archive/company-1/b.ndjson.gz' }],
          IsTruncated: false,
        });
      }
      throw new Error('unexpected command');
    });
    const client = { send } as unknown as S3Client;
    const store = new PositionCheckArchiveStoreService(client, fakeConfig());

    const keys = await store.listArchiveKeys('company-1');

    expect(keys).toEqual([
      'position-check-archive/company-1/a.ndjson.gz',
      'position-check-archive/company-1/b.ndjson.gz',
    ]);
    const listCalls = send.mock.calls.filter(
      (call) => call[0] instanceof ListObjectsV2Command,
    );
    expect((listCalls[0][0] as ListObjectsV2Command).input.Prefix).toBe(
      'position-check-archive/company-1/',
    );
  });
});

describe('PositionCheckArchiveStoreService.getArchiveRecords', () => {
  it('скачивает, распаковывает и парсит NDJSON построчно', async () => {
    const ndjson = [record, { ...record, id: 'r2' }]
      .map((r) => JSON.stringify(r))
      .join('\n');
    const gzipped = gzipSync(Buffer.from(ndjson, 'utf-8'));

    const send = jest.fn((command: unknown) => {
      if (command instanceof GetObjectCommand) {
        return Promise.resolve({
          Body: { transformToByteArray: () => Promise.resolve(gzipped) },
        });
      }
      throw new Error('unexpected command');
    });
    const client = { send } as unknown as S3Client;
    const store = new PositionCheckArchiveStoreService(client, fakeConfig());

    const records = await store.getArchiveRecords('some-key');

    expect(records).toEqual([record, { ...record, id: 'r2' }]);
  });

  it('нет Body в ответе — падает с понятной ошибкой', async () => {
    const send = jest.fn((command: unknown) => {
      if (command instanceof GetObjectCommand) return Promise.resolve({});
      throw new Error('unexpected command');
    });
    const client = { send } as unknown as S3Client;
    const store = new PositionCheckArchiveStoreService(client, fakeConfig());

    await expect(store.getArchiveRecords('some-key')).rejects.toThrow(
      'Archive object some-key has no body',
    );
  });
});

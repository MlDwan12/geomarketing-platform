import { ConfigService } from '@nestjs/config';
import { FindManyOptions, FindOperator, Repository } from 'typeorm';
import { PositionCheckCleanupService } from './position-check-cleanup.service';
import { PositionCheckResult } from '../entities/position-check-result.entity';
import {
  ArchivedPositionCheckRecord,
  PositionCheckArchiveStoreService,
} from '../archive/position-check-archive-store.service';

type PutArchiveArgs = [string, Date, ArchivedPositionCheckRecord[]];

function fakeConfig(retentionDays?: string) {
  return {
    get: jest.fn((key: string) =>
      key === 'POSITION_CHECK_RETENTION_DAYS' ? retentionDays : undefined,
    ),
  } as unknown as ConfigService;
}

function fakeRepo(records: PositionCheckResult[]) {
  const find = jest
    .fn<
      Promise<PositionCheckResult[]>,
      [FindManyOptions<PositionCheckResult>]
    >()
    .mockResolvedValue(records);
  const deleteFn = jest.fn().mockResolvedValue({ affected: 1 });
  const repo = {
    find,
    delete: deleteFn,
  } as unknown as Repository<PositionCheckResult>;
  return { repo, find, delete: deleteFn };
}

function fakeArchiveStore() {
  const putArchive = jest
    .fn<Promise<void>, PutArchiveArgs>()
    .mockResolvedValue(undefined);
  const service = {
    putArchive,
  } as unknown as PositionCheckArchiveStoreService;
  return { service, putArchive };
}

function oldRecord(
  overrides: Partial<PositionCheckResult> = {},
): PositionCheckResult {
  return {
    id: 'r1',
    companyId: 'company-1',
    keyword: 'кофейня',
    source: 'manual',
    provider: '2gis',
    position: 1,
    checkedAt: new Date('2020-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('PositionCheckCleanupService.runCleanup', () => {
  it('нет старых записей — ничего не архивируется и не удаляется', async () => {
    const repo = fakeRepo([]);
    const archiveStore = fakeArchiveStore();
    const service = new PositionCheckCleanupService(
      repo.repo,
      archiveStore.service,
      fakeConfig(),
    );

    const summary = await service.runCleanup();

    expect(summary).toEqual({ companiesProcessed: 0, recordsArchived: 0 });
    expect(archiveStore.putArchive).not.toHaveBeenCalled();
    expect(repo.delete).not.toHaveBeenCalled();
  });

  it('группирует старые записи по companyId, архивирует и удаляет каждую группу', async () => {
    const records = [
      oldRecord({ id: 'r1', companyId: 'company-1' }),
      oldRecord({ id: 'r2', companyId: 'company-1' }),
      oldRecord({ id: 'r3', companyId: 'company-2' }),
    ];
    const repo = fakeRepo(records);
    const archiveStore = fakeArchiveStore();
    const service = new PositionCheckCleanupService(
      repo.repo,
      archiveStore.service,
      fakeConfig(),
    );

    const summary = await service.runCleanup();

    expect(summary).toEqual({ companiesProcessed: 2, recordsArchived: 3 });
    expect(archiveStore.putArchive).toHaveBeenCalledTimes(2);
    const company1Call = archiveStore.putArchive.mock.calls.find(
      (call) => call[0] === 'company-1',
    );
    expect(company1Call?.[2]).toEqual([
      expect.objectContaining({ id: 'r1' }),
      expect.objectContaining({ id: 'r2' }),
    ]);
    expect(repo.delete).toHaveBeenCalledWith(['r1', 'r2']);
    expect(repo.delete).toHaveBeenCalledWith(['r3']);
  });

  it('архивация одной компании падает — остальные всё равно обрабатываются (партиальный успех)', async () => {
    const records = [
      oldRecord({ id: 'r1', companyId: 'company-1' }),
      oldRecord({ id: 'r2', companyId: 'company-2' }),
    ];
    const repo = fakeRepo(records);
    const archiveStore = fakeArchiveStore();
    archiveStore.putArchive.mockImplementation((companyId) =>
      companyId === 'company-1'
        ? Promise.reject(new Error('MinIO недоступен'))
        : Promise.resolve(undefined),
    );
    const service = new PositionCheckCleanupService(
      repo.repo,
      archiveStore.service,
      fakeConfig(),
    );

    const summary = await service.runCleanup();

    expect(summary).toEqual({ companiesProcessed: 1, recordsArchived: 1 });
    expect(repo.delete).toHaveBeenCalledTimes(1);
    expect(repo.delete).toHaveBeenCalledWith(['r2']);
    expect(repo.delete).not.toHaveBeenCalledWith(['r1']);
  });

  it('удаление НЕ вызывается, если загрузка в архив не подтверждена', async () => {
    const records = [oldRecord({ id: 'r1', companyId: 'company-1' })];
    const repo = fakeRepo(records);
    const archiveStore = fakeArchiveStore();
    archiveStore.putArchive.mockRejectedValue(new Error('MinIO упал'));
    const service = new PositionCheckCleanupService(
      repo.repo,
      archiveStore.service,
      fakeConfig(),
    );

    await service.runCleanup();

    expect(repo.delete).not.toHaveBeenCalled();
  });

  it('порог по умолчанию — 90 дней, если POSITION_CHECK_RETENTION_DAYS не задан', async () => {
    const repo = fakeRepo([]);
    const service = new PositionCheckCleanupService(
      repo.repo,
      fakeArchiveStore().service,
      fakeConfig(undefined),
    );

    await service.runCleanup();

    const where = repo.find.mock.calls[0][0].where as {
      checkedAt: FindOperator<Date>;
    };
    const threshold = where.checkedAt.value;
    const expected = new Date();
    expected.setDate(expected.getDate() - 90);
    expect(Math.abs(threshold.getTime() - expected.getTime())).toBeLessThan(
      5000,
    );
  });

  it('порог настраивается через POSITION_CHECK_RETENTION_DAYS', async () => {
    const repo = fakeRepo([]);
    const service = new PositionCheckCleanupService(
      repo.repo,
      fakeArchiveStore().service,
      fakeConfig('30'),
    );

    await service.runCleanup();

    const where = repo.find.mock.calls[0][0].where as {
      checkedAt: FindOperator<Date>;
    };
    const threshold = where.checkedAt.value;
    const expected = new Date();
    expected.setDate(expected.getDate() - 30);
    expect(Math.abs(threshold.getTime() - expected.getTime())).toBeLessThan(
      5000,
    );
  });
});

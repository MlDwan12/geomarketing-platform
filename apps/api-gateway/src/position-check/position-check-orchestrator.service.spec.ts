import { Observable, of } from 'rxjs';
import { ClientProxy } from '@nestjs/microservices';
import { Patterns } from '@geo/contracts';
import { PositionCheckOrchestratorService } from './position-check-orchestrator.service';

function fakeClient(responses: Record<string, unknown>) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const send = jest.fn((pattern: string, _payload: unknown) =>
    of(responses[pattern]),
  );
  return { client: { send } as unknown as ClientProxy, send };
}

const companyWithCategory = {
  id: 'company-1',
  name: 'Моё Кафе',
  coordinates: [37.6, 55.75] as [number, number],
  card: { fields: { mainCategory: { default: { id: 'r1', name: 'Кафе' } } } },
};

const companyWithoutCategory = {
  id: 'company-1',
  name: 'Моё Кафе',
  coordinates: [37.6, 55.75] as [number, number],
  card: { fields: {} },
};

describe('PositionCheckOrchestratorService.checkPositions', () => {
  it('авто-слово (категория) + ручные слова — оба вместе идут в проверку и сохранение', async () => {
    const core = fakeClient({
      [Patterns.COMPANY_GET]: companyWithCategory,
      [Patterns.POSITION_KEYWORDS_LIST]: [{ keyword: 'кофейня' }],
      [Patterns.POSITION_CHECK_SAVE]: [{ id: 'r1' }, { id: 'r2' }],
    });
    const integration = fakeClient({
      [Patterns.POSITION_CHECK_FIND]: [
        { keyword: 'Кафе', provider: '2gis', position: 0 },
        { keyword: 'кофейня', provider: 'yandex', position: 3 },
      ],
    });
    const orchestrator = new PositionCheckOrchestratorService(
      core.client,
      integration.client,
    );

    const result = await orchestrator.checkPositions(
      'company-1',
      'brand-1',
      'user-1',
    );

    const findCall = integration.send.mock.calls.find(
      (call) => call[0] === Patterns.POSITION_CHECK_FIND,
    )?.[1] as { keywords: string[] };
    expect(findCall.keywords).toEqual(
      expect.arrayContaining(['Кафе', 'кофейня']),
    );
    expect(findCall.keywords).toHaveLength(2);

    const saveCall = core.send.mock.calls.find(
      (call) => call[0] === Patterns.POSITION_CHECK_SAVE,
    )?.[1] as { results: { keyword: string; source: string }[] };
    expect(saveCall.results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          keyword: 'Кафе',
          source: 'auto',
          provider: '2gis',
          position: 0,
        }),
        expect.objectContaining({
          keyword: 'кофейня',
          source: 'manual',
          provider: 'yandex',
          position: 3,
        }),
      ]),
    );
    expect(result).toEqual([{ id: 'r1' }, { id: 'r2' }]);
  });

  it('только авто-слово — нет ручных, POSITION_KEYWORDS_LIST пуст', async () => {
    const core = fakeClient({
      [Patterns.COMPANY_GET]: companyWithCategory,
      [Patterns.POSITION_KEYWORDS_LIST]: [],
      [Patterns.POSITION_CHECK_SAVE]: [{ id: 'r1' }],
    });
    const integration = fakeClient({
      [Patterns.POSITION_CHECK_FIND]: [
        { keyword: 'Кафе', provider: '2gis', position: 1 },
      ],
    });
    const orchestrator = new PositionCheckOrchestratorService(
      core.client,
      integration.client,
    );

    await orchestrator.checkPositions('company-1', 'brand-1', 'user-1');

    const findCall = integration.send.mock.calls.find(
      (call) => call[0] === Patterns.POSITION_CHECK_FIND,
    )?.[1] as { keywords: string[] };
    expect(findCall.keywords).toEqual(['Кафе']);
  });

  it('только ручные слова — нет категории в карточке', async () => {
    const core = fakeClient({
      [Patterns.COMPANY_GET]: companyWithoutCategory,
      [Patterns.POSITION_KEYWORDS_LIST]: [{ keyword: 'кофейня' }],
      [Patterns.POSITION_CHECK_SAVE]: [{ id: 'r1' }],
    });
    const integration = fakeClient({
      [Patterns.POSITION_CHECK_FIND]: [
        { keyword: 'кофейня', provider: '2gis', position: null },
      ],
    });
    const orchestrator = new PositionCheckOrchestratorService(
      core.client,
      integration.client,
    );

    await orchestrator.checkPositions('company-1', 'brand-1', 'user-1');

    const findCall = integration.send.mock.calls.find(
      (call) => call[0] === Patterns.POSITION_CHECK_FIND,
    )?.[1] as { keywords: string[] };
    expect(findCall.keywords).toEqual(['кофейня']);
  });

  it('ни авто, ни ручных слов — пустой результат, ничего не проверяется и не сохраняется', async () => {
    const core = fakeClient({
      [Patterns.COMPANY_GET]: companyWithoutCategory,
      [Patterns.POSITION_KEYWORDS_LIST]: [],
    });
    const integration = fakeClient({});
    const orchestrator = new PositionCheckOrchestratorService(
      core.client,
      integration.client,
    );

    const result = await orchestrator.checkPositions(
      'company-1',
      'brand-1',
      'user-1',
    );

    expect(result).toEqual([]);
    expect(integration.send).not.toHaveBeenCalled();
    expect(core.send).not.toHaveBeenCalledWith(
      Patterns.POSITION_CHECK_SAVE,
      expect.anything(),
    );
  });

  it('одинаковое слово из авто и ручного списка не дублируется в проверке', async () => {
    const core = fakeClient({
      [Patterns.COMPANY_GET]: companyWithCategory,
      [Patterns.POSITION_KEYWORDS_LIST]: [{ keyword: 'Кафе' }],
      [Patterns.POSITION_CHECK_SAVE]: [],
    });
    const integration = fakeClient({
      [Patterns.POSITION_CHECK_FIND]: [
        { keyword: 'Кафе', provider: '2gis', position: 0 },
      ],
    });
    const orchestrator = new PositionCheckOrchestratorService(
      core.client,
      integration.client,
    );

    await orchestrator.checkPositions('company-1', 'brand-1', 'user-1');

    const findCall = integration.send.mock.calls.find(
      (call) => call[0] === Patterns.POSITION_CHECK_FIND,
    )?.[1] as { keywords: string[] };
    expect(findCall.keywords).toEqual(['Кафе']);
  });

  it('частичный результат от integration-service (не все слова×провайдеры) — сохраняется как есть', async () => {
    const core = fakeClient({
      [Patterns.COMPANY_GET]: companyWithoutCategory,
      [Patterns.POSITION_KEYWORDS_LIST]: [
        { keyword: 'кофейня' },
        { keyword: 'кафе' },
      ],
      [Patterns.POSITION_CHECK_SAVE]: [{ id: 'r1' }],
    });
    const integration = fakeClient({
      // Только одна пара keyword×provider успела вернуться — вторая
      // упала на стороне integration-service (partial success, коммит 3).
      [Patterns.POSITION_CHECK_FIND]: [
        { keyword: 'кофейня', provider: '2gis', position: 2 },
      ],
    });
    const orchestrator = new PositionCheckOrchestratorService(
      core.client,
      integration.client,
    );

    await orchestrator.checkPositions('company-1', 'brand-1', 'user-1');

    const saveCall = core.send.mock.calls.find(
      (call) => call[0] === Patterns.POSITION_CHECK_SAVE,
    )?.[1] as { results: unknown[] };
    expect(saveCall.results).toEqual([
      { keyword: 'кофейня', provider: '2gis', position: 2, source: 'manual' },
    ]);
  });
});

describe('PositionCheckOrchestratorService.checkPositionsForBrand', () => {
  const companiesForListing = [{ id: 'c1' }, { id: 'c2' }];

  it('проверяет каждую компанию бренда, полученную через COMPANY_LIST_FOR_VISIBILITY', async () => {
    const core = fakeClient({
      [Patterns.COMPANY_LIST_FOR_VISIBILITY]: companiesForListing,
      [Patterns.COMPANY_GET]: companyWithoutCategory,
      [Patterns.POSITION_KEYWORDS_LIST]: [{ keyword: 'кофейня' }],
      [Patterns.POSITION_CHECK_SAVE]: [{ id: 'r1' }],
    });
    const integration = fakeClient({
      [Patterns.POSITION_CHECK_FIND]: [
        { keyword: 'кофейня', provider: '2gis', position: 1 },
      ],
    });
    const orchestrator = new PositionCheckOrchestratorService(
      core.client,
      integration.client,
    );

    const results = await orchestrator.checkPositionsForBrand(
      'brand-1',
      'user-1',
    );

    expect(core.send).toHaveBeenCalledWith(
      Patterns.COMPANY_LIST_FOR_VISIBILITY,
      {
        brandId: 'brand-1',
        userId: 'user-1',
      },
    );
    expect(results).toEqual([
      { companyId: 'c1', success: true, results: [{ id: 'r1' }] },
      { companyId: 'c2', success: true, results: [{ id: 'r1' }] },
    ]);
  });

  it('одна компания упала — партиальный успех, остальные всё равно обрабатываются', async () => {
    const send = jest.fn((pattern: string, payload: unknown) => {
      if (pattern === Patterns.COMPANY_LIST_FOR_VISIBILITY) {
        return of(companiesForListing);
      }
      if (pattern === Patterns.COMPANY_GET) {
        const { companyId } = payload as { companyId: string };
        if (companyId === 'c1') throw new Error('core-service недоступен');
        return of({ ...companyWithoutCategory, id: companyId });
      }
      if (pattern === Patterns.POSITION_KEYWORDS_LIST) return of([]);
      if (pattern === Patterns.POSITION_CHECK_SAVE) return of([]);
      return of(undefined);
    });
    const core = { client: { send } as unknown as ClientProxy, send };
    const integration = fakeClient({ [Patterns.POSITION_CHECK_FIND]: [] });
    const orchestrator = new PositionCheckOrchestratorService(
      core.client,
      integration.client,
    );

    const results = await orchestrator.checkPositionsForBrand(
      'brand-1',
      'user-1',
    );

    expect(results).toEqual([
      { companyId: 'c1', success: false, error: 'core-service недоступен' },
      { companyId: 'c2', success: true, results: [] },
    ]);
  });

  it('компания без ключевых слов и координат — success: true, results: [] (не ошибка)', async () => {
    const core = fakeClient({
      [Patterns.COMPANY_LIST_FOR_VISIBILITY]: [{ id: 'c1' }],
      [Patterns.COMPANY_GET]: { ...companyWithoutCategory, coordinates: null },
      [Patterns.POSITION_KEYWORDS_LIST]: [],
    });
    const integration = fakeClient({});
    const orchestrator = new PositionCheckOrchestratorService(
      core.client,
      integration.client,
    );

    const results = await orchestrator.checkPositionsForBrand(
      'brand-1',
      'user-1',
    );

    expect(results).toEqual([{ companyId: 'c1', success: true, results: [] }]);
    expect(integration.send).not.toHaveBeenCalled();
  });

  it('батчи по BRAND_BATCH_CONCURRENCY=5 — 6-я компания не стартует, пока не освободится слот', async () => {
    const companies = Array.from({ length: 6 }, (_, i) => ({ id: `c${i}` }));
    let current = 0;
    let maxConcurrent = 0;
    const send = jest.fn((pattern: string) => {
      if (pattern === Patterns.COMPANY_LIST_FOR_VISIBILITY) {
        return of(companies);
      }
      if (pattern === Patterns.COMPANY_GET) {
        current += 1;
        maxConcurrent = Math.max(maxConcurrent, current);
        return new Observable((subscriber) => {
          setTimeout(() => {
            current -= 1;
            subscriber.next(companyWithoutCategory);
            subscriber.complete();
          }, 5);
        });
      }
      if (pattern === Patterns.POSITION_KEYWORDS_LIST) return of([]);
      return of(undefined);
    });
    const core = { client: { send } as unknown as ClientProxy, send };
    const integration = fakeClient({});
    const orchestrator = new PositionCheckOrchestratorService(
      core.client,
      integration.client,
    );

    await orchestrator.checkPositionsForBrand('brand-1', 'user-1');

    expect(maxConcurrent).toBeLessThanOrEqual(5);
  });
});

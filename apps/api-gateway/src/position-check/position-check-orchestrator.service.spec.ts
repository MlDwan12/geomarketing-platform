import { of } from 'rxjs';
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

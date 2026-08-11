import { of, throwError } from 'rxjs';
import { ClientProxy } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';
import { HealthService } from './health.service';

function fakeClient(shouldFail = false) {
  const send = jest.fn(() =>
    shouldFail ? throwError(() => new Error('unreachable')) : of({}),
  );
  return { client: { send } as unknown as ClientProxy, send };
}

function fakeConfig(): ConfigService {
  return {
    get: (key: string) =>
      key === 'MAP_PARSER_URL' ? 'http://localhost:3005' : 'token',
  } as unknown as ConfigService;
}

describe('HealthService.checkAll', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('все 5 сервисов живы — status ok', async () => {
    const core = fakeClient();
    const integration = fakeClient();
    const ai = fakeClient();
    const review = fakeClient();
    global.fetch = jest.fn().mockResolvedValue({ ok: true }) as typeof fetch;

    const service = new HealthService(
      core.client,
      integration.client,
      ai.client,
      review.client,
      fakeConfig(),
    );

    const result = await service.checkAll();

    expect(result.status).toBe('ok');
    expect(result.services).toEqual({
      core: { status: 'ok' },
      integration: { status: 'ok' },
      ai: { status: 'ok' },
      review: { status: 'ok' },
      mapParser: { status: 'ok' },
    });
  });

  it('ai-service недоступен — status degraded, остальные ok', async () => {
    const core = fakeClient();
    const integration = fakeClient();
    const ai = fakeClient(true);
    const review = fakeClient();
    global.fetch = jest.fn().mockResolvedValue({ ok: true }) as typeof fetch;

    const service = new HealthService(
      core.client,
      integration.client,
      ai.client,
      review.client,
      fakeConfig(),
    );

    const result = await service.checkAll();

    expect(result.status).toBe('degraded');
    expect(result.services.ai.status).toBe('error');
    expect(result.services.ai.error).toBe('unreachable');
    expect(result.services.core.status).toBe('ok');
  });

  it('map-parser отвечает не-2xx — status degraded', async () => {
    const core = fakeClient();
    const integration = fakeClient();
    const ai = fakeClient();
    const review = fakeClient();
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 503,
    }) as typeof fetch;

    const service = new HealthService(
      core.client,
      integration.client,
      ai.client,
      review.client,
      fakeConfig(),
    );

    const result = await service.checkAll();

    expect(result.status).toBe('degraded');
    expect(result.services.mapParser).toEqual({
      status: 'error',
      error: 'HTTP 503',
    });
  });
});

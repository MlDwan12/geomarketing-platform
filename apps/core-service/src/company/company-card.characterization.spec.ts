/**
 * Characterization-тесты (Этап 0 рефакторинга).
 *
 * Фиксируют ТЕКУЩЕЕ поведение логики полей карточки и slug, чтобы будущий
 * рефакторинг (ARCH-001 декомпозиция, ARCH-003 унификация assemble/resolve,
 * DB-002 slug) не изменил наблюдаемый результат.
 *
 * Тестируются чистые методы CompanyService, не обращающиеся к репозиториям,
 * поэтому сервис создаётся с dummy-зависимостями.
 *
 * ВНИМАНИЕ: тесты документируют РЕАЛЬНОЕ поведение (в т.ч. незакоммиченную
 * правку `key in templateFields`), а не желаемое. Не менять ожидания без
 * согласованного изменения поведения.
 */
import { CompanyService } from './company.service';

// Доступ к приватным/чистым методам сервиса в характеризационных целях.
// Свободные типы параметров — чтобы литералы фикстур не требовали приведений.
type PureMethods = {
  resolveForPlatform: (
    platformKey: string,
    templateFields: Record<string, unknown>,
    overrides: Record<string, unknown>,
  ) => Record<string, unknown>;
  assembleCardFields: (
    def: unknown,
    template: unknown,
  ) => Record<string, unknown>;
  slugify: (text: string) => string;
};

function svc(): PureMethods {
  // 6 репозиториев + DataSource + CompanyAccessService + 3 под-сервиса (Этап 4.1/4.2);
  // тестируемые чистые методы их не используют.
  const deps = Array(11).fill(null) as unknown[];
  const Ctor = CompanyService as unknown as new (
    ...args: unknown[]
  ) => CompanyService;
  return new Ctor(...deps) as unknown as PureMethods;
}

describe('CompanyService.resolveForPlatform (characterization)', () => {
  it('приоритет: company value (override) над template', () => {
    const s = svc();
    const result = s.resolveForPlatform(
      'yandex',
      { phone: 'T', email: 'E' },
      { phone: { value: 'C', isException: true } },
    );
    expect(result).toEqual({ phone: 'C', email: 'E' });
  });

  it('platform override перекрывает базовое значение', () => {
    const s = svc();
    const result = s.resolveForPlatform(
      'yandex',
      {},
      { phone: { value: 'C', platforms: { yandex: 'Y' } } },
    );
    expect(result).toEqual({ phone: 'Y' });
  });

  it('lang-поля мержатся по языку, а не заменяются целиком', () => {
    const s = svc();
    const result = s.resolveForPlatform(
      'yandex',
      {},
      {
        names: {
          value: [
            { lang: 'ru', val: 'А' },
            { lang: 'en', val: 'A' },
          ],
          platforms: { yandex: [{ lang: 'en', val: 'A2' }] },
        },
      },
    );
    expect(result).toEqual({
      names: [
        { lang: 'ru', val: 'А' },
        { lang: 'en', val: 'A2' },
      ],
    });
  });

  it('isException:false игнорирует company value, берёт template', () => {
    const s = svc();
    const result = s.resolveForPlatform(
      'yandex',
      { phone: 'T' },
      { phone: { value: 'C', isException: false } },
    );
    expect(result).toEqual({ phone: 'T' });
  });

  it('isException не задан (undefined) — override всё равно побеждает над template', () => {
    const s = svc();
    const result = s.resolveForPlatform(
      'yandex',
      { phone: 'T' },
      { phone: { value: 'C' } },
    );
    expect(result).toEqual({ phone: 'C' });
  });
});

describe('CompanyService.assembleCardFields (characterization)', () => {
  it('def=null, template=null → пустой объект', () => {
    const s = svc();
    expect(s.assembleCardFields(null, null)).toEqual({});
  });

  it('без шаблона: форма { default, platforms }', () => {
    const s = svc();
    const result = s.assembleCardFields(
      {
        fieldOverrides: {
          phone: { value: 'C', platforms: { yandex: { x: 1 } } },
        },
      },
      null,
    );
    expect(result).toEqual({
      phone: { default: 'C', platforms: { yandex: { x: 1 } } },
    });
  });

  it('с шаблоном + isException: форма { isException:true, default, platforms }', () => {
    const s = svc();
    const result = s.assembleCardFields(
      {
        fieldOverrides: {
          phone: { isException: true, value: 'C', platforms: {} },
        },
      },
      { fields: { phone: { default: 'T' } } },
    );
    expect(result).toEqual({
      phone: { isException: true, default: 'C', platforms: {} },
    });
  });

  it('с шаблоном без exception: default берётся из шаблона', () => {
    const s = svc();
    const result = s.assembleCardFields(
      { fieldOverrides: { phone: { isException: false } } },
      { fields: { phone: { default: 'T' } } },
    );
    expect(result).toEqual({
      phone: { isException: false, default: 'T', platforms: {} },
    });
  });

  it('WIP-правка: ключ есть в override, но НЕ в шаблоне → трактуется как no-template', () => {
    const s = svc();
    const result = s.assembleCardFields(
      { fieldOverrides: { email: { value: 'X' } } },
      { fields: { phone: { default: 'T' } } },
    );
    expect(result).toEqual({
      phone: { isException: false, default: 'T', platforms: {} },
      email: { default: 'X', platforms: {} },
    });
  });

  it('ФИКС (ARCH-003, Этап 5.2): isException не задан + шаблон есть → override.value побеждает (как в resolveForPlatform выше), а не default из шаблона', () => {
    const s = svc();
    const result = s.assembleCardFields(
      { fieldOverrides: { phone: { value: 'C' } } },
      { fields: { phone: { default: 'T' } } },
    );
    expect(result).toEqual({
      phone: { isException: true, default: 'C', platforms: {} },
    });
  });
});

describe('CompanyService.slugify (characterization)', () => {
  it('транслитерация RU→EN + нормализация', () => {
    const s = svc();
    expect(s.slugify('Кофейня №1')).toBe('kofeynya-1');
    expect(s.slugify('ООО "Ромашка"')).toBe('ooo-romashka');
    expect(s.slugify('  Test  Name  ')).toBe('test-name');
  });
});

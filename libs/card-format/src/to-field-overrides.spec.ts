import { toFieldOverrides } from './to-field-overrides';

describe('toFieldOverrides', () => {
  it('оборачивает каждое значение в { value }', () => {
    expect(
      toFieldOverrides({ phones: [{ value: '+7' }], websites: ['a.com'] }),
    ).toEqual({
      phones: { value: [{ value: '+7' }] },
      websites: { value: ['a.com'] },
    });
  });

  it('пустой объект даёт пустой результат', () => {
    expect(toFieldOverrides({})).toEqual({});
  });
});

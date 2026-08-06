import {
  normalizeTwoGisCatalogItem,
  TwoGisCatalogItem,
} from './normalize-two-gis-catalog-item';

describe('normalizeTwoGisCatalogItem', () => {
  it('primary-рубрика идёт в mainCategory, остальные — в additionalCategories', () => {
    const item: TwoGisCatalogItem = {
      rubrics: [
        { id: '1', name: 'Кафе', kind: 'primary' },
        { id: '2', name: 'Ресторан', kind: 'additional' },
        { id: '3', name: 'Бар', kind: 'additional' },
      ],
    };

    expect(normalizeTwoGisCatalogItem(item)).toEqual({
      mainCategory: { id: '1', name: 'Кафе' },
      additionalCategories: [
        { id: '2', name: 'Ресторан' },
        { id: '3', name: 'Бар' },
      ],
    });
  });

  it('контакты разбираются по типу: phone/website/остальное — socials', () => {
    const item: TwoGisCatalogItem = {
      contact_groups: [
        {
          contacts: [
            { type: 'phone', value: '+7 999 000-00-00', comment: 'офис' },
            { type: 'website', value: 'https://example.com' },
            { type: 'vkontakte', value: 'https://vk.com/example' },
          ],
        },
      ],
    };

    expect(normalizeTwoGisCatalogItem(item)).toEqual({
      phones: [{ value: '+7 999 000-00-00', comment: 'офис' }],
      websites: ['https://example.com'],
      socials: [{ type: 'vkontakte', value: 'https://vk.com/example' }],
    });
  });

  it('schedule копируется как есть, без трансформации формата', () => {
    const schedule = {
      Mon: { working_hours: [{ from: '09:00', to: '18:00' }] },
    };
    expect(normalizeTwoGisCatalogItem({ schedule })).toEqual({ schedule });
  });

  it('отсутствующие поля не создают пустые ключи в результате', () => {
    expect(normalizeTwoGisCatalogItem({})).toEqual({});
  });

  it('name превращается в names: [{ lang: "ru", val }] (баг: раньше не заполнялось)', () => {
    expect(normalizeTwoGisCatalogItem({}, 'Кафе Пушкинъ')).toEqual({
      names: [{ lang: 'ru', val: 'Кафе Пушкинъ' }],
    });
  });

  it('без переданного name ключ names не создаётся', () => {
    expect(normalizeTwoGisCatalogItem({})).not.toHaveProperty('names');
  });
});

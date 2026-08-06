import { QueryFailedError } from 'typeorm';
import { isUniqueViolation } from './unique-violation.util';

function makeQueryFailedError(constraint?: string): QueryFailedError {
  const driverError = new Error('duplicate key value') as Error & {
    constraint?: string;
  };
  driverError.constraint = constraint;
  return new QueryFailedError('INSERT INTO x', [], driverError);
}

describe('isUniqueViolation', () => {
  it('true, если это QueryFailedError с совпадающим constraint', () => {
    expect(
      isUniqueViolation(
        makeQueryFailedError('UQ_companies_slug'),
        'UQ_companies_slug',
      ),
    ).toBe(true);
  });

  it('false, если constraint другой', () => {
    expect(
      isUniqueViolation(
        makeQueryFailedError('UQ_brands_slug'),
        'UQ_companies_slug',
      ),
    ).toBe(false);
  });

  it('false для обычной ошибки (не QueryFailedError)', () => {
    expect(isUniqueViolation(new Error('boom'), 'UQ_companies_slug')).toBe(
      false,
    );
  });
});

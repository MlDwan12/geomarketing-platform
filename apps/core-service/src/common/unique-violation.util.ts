import { QueryFailedError } from 'typeorm';

// DB-002: Postgres unique_violation (SQLSTATE 23505) на конкретном
// констрейнте — используется, чтобы отличить гонку на уникальном поле
// (можно безопасно повторить с новым значением) от прочих ошибок запроса.
export function isUniqueViolation(err: unknown, constraint: string): boolean {
  return (
    err instanceof QueryFailedError &&
    (err.driverError as { constraint?: string } | undefined)?.constraint ===
      constraint
  );
}

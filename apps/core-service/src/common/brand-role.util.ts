import { BrandRole } from '../brand/user-brand.entity';

// Строгость BrandRole не завязана на порядок объявления enum — явный ранг.
const ROLE_RANK: Record<BrandRole, number> = {
  [BrandRole.Viewer]: 0,
  [BrandRole.Manager]: 1,
  [BrandRole.Owner]: 2,
};

export function hasMinRole(role: BrandRole, min: BrandRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[min];
}

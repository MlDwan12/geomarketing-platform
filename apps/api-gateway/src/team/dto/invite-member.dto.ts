import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsIn } from 'class-validator';

// Owner исключён намеренно — единственный, совпадает с Brand.ownerId,
// передача владения не поддерживается (см. CONTEXT.md, BrandRole).
const INVITABLE_ROLES = ['manager', 'viewer'] as const;

export class InviteMemberDto {
  @ApiProperty({ format: 'email' })
  @IsEmail({}, { message: 'Некорректный email' })
  email!: string;

  @ApiProperty({ enum: INVITABLE_ROLES })
  @IsIn(INVITABLE_ROLES, { message: 'role должен быть manager или viewer' })
  role!: 'manager' | 'viewer';
}

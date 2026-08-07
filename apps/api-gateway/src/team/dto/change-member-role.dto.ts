import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

// Owner исключён намеренно — см. invite-member.dto.ts.
const ASSIGNABLE_ROLES = ['manager', 'viewer'] as const;

export class ChangeMemberRoleDto {
  @ApiProperty({ enum: ASSIGNABLE_ROLES })
  @IsIn(ASSIGNABLE_ROLES, { message: 'role должен быть manager или viewer' })
  role!: 'manager' | 'viewer';
}

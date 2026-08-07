import { ApiProperty } from '@nestjs/swagger';

// Урезанная форма пользователя, которую login/register реально возвращают
// (не весь профиль, см. UserProfileResponseDto для GET /auth/me).
export class AuthUserSummaryResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ format: 'email' })
  email!: string;

  @ApiProperty({ nullable: true, type: String })
  avatarUrl!: string | null;

  @ApiProperty({ nullable: true, type: String, format: 'date-time' })
  lastLoginAt!: string | null;
}

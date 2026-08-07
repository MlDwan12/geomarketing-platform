import { ApiProperty } from '@nestjs/swagger';

export class TeamMemberResponseDto {
  @ApiProperty({ format: 'uuid' })
  userId!: string;

  @ApiProperty({ nullable: true, type: String })
  name!: string | null;

  @ApiProperty({ nullable: true, type: String, format: 'email' })
  email!: string | null;

  @ApiProperty({ nullable: true, type: String })
  avatarUrl!: string | null;

  @ApiProperty({ enum: ['owner', 'manager', 'viewer'] })
  role!: string;

  @ApiProperty({ enum: ['active', 'suspended', 'left', 'pending'] })
  status!: string;

  @ApiProperty({ format: 'date-time' })
  joinedAt!: string;

  @ApiProperty({ nullable: true, type: String, format: 'date-time' })
  lastLoginAt!: string | null;
}

// Не включает tokenHash — секрет никогда не отдаётся клиенту (см. также
// forgot-password/reset-password — тот же принцип для password-reset).
export class TeamInvitationResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  brandId!: string;

  @ApiProperty({ format: 'email' })
  email!: string;

  @ApiProperty({ enum: ['manager', 'viewer'] })
  role!: string;

  @ApiProperty({ format: 'uuid' })
  invitedByUserId!: string;

  @ApiProperty({ enum: ['pending', 'accepted', 'revoked', 'expired'] })
  status!: string;

  @ApiProperty({ format: 'date-time' })
  expiresAt!: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}

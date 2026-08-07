import { ApiProperty } from '@nestjs/swagger';

// Форма ответа core-service USER_GET_PROFILE/USER_UPDATE_PROFILE — полная
// сущность User (кроме passwordHash, у неё select:false на уровне TypeORM).
// Статус — локальная копия значений enum core-service (UserStatus), не
// импортируется напрямую — микросервисы не делят типы (см.
// company-visibility.controller.ts, тот же принцип).
export class UserProfileResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ nullable: true, type: String })
  fullName!: string | null;

  @ApiProperty({ format: 'email' })
  email!: string;

  @ApiProperty({ enum: ['active', 'suspended', 'left', 'pending'] })
  status!: string;

  @ApiProperty({ nullable: true, type: String })
  phone!: string | null;

  @ApiProperty({ nullable: true, type: String })
  telegram!: string | null;

  @ApiProperty()
  twoFaEnabled!: boolean;

  @ApiProperty({ nullable: true, type: String })
  avatarUrl!: string | null;

  @ApiProperty({ nullable: true, type: String, description: 'IANA timezone' })
  timezone!: string | null;

  @ApiProperty({ nullable: true, type: String, description: 'напр. "ru"' })
  locale!: string | null;

  @ApiProperty({ nullable: true, type: String })
  refCode!: string | null;

  @ApiProperty({ nullable: true, type: String, format: 'uuid' })
  referredById!: string | null;

  @ApiProperty({ nullable: true, type: String, format: 'date-time' })
  lastLoginAt!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}

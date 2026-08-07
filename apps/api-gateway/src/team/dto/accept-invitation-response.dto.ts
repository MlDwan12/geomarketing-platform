import { ApiProperty } from '@nestjs/swagger';

export class AcceptInvitationResponseDto {
  @ApiProperty({ format: 'uuid' })
  userId!: string;

  @ApiProperty({ format: 'uuid' })
  brandId!: string;

  @ApiProperty({ enum: ['manager', 'viewer'] })
  role!: string;
}

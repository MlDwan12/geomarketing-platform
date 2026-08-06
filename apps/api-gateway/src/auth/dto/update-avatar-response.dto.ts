import { ApiProperty } from '@nestjs/swagger';

export class UpdateAvatarResponseDto {
  @ApiProperty()
  avatarUrl!: string;
}

import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUrl, MaxLength } from 'class-validator';

export class UpdateAvatarDto {
  @ApiProperty({
    maxLength: 500,
    description: 'URL уже загруженного файла (см. POST /upload/logo)',
  })
  @IsString()
  @IsUrl()
  @MaxLength(500)
  avatarUrl!: string;
}

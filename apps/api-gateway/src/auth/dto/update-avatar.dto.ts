import { IsString, IsUrl, MaxLength } from 'class-validator';

export class UpdateAvatarDto {
  @IsString()
  @IsUrl()
  @MaxLength(500)
  avatarUrl: string;
}

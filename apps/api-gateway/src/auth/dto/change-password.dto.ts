import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  currentPassword!: string;

  @ApiProperty({ minLength: 8, description: 'Минимум 8 символов' })
  @IsString()
  @MinLength(8, { message: 'Новый пароль должен быть не менее 8 символов' })
  newPassword!: string;
}

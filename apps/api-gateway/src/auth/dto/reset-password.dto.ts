import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({ description: 'Токен из письма/dev-лога PWD_RESET_CREATE' })
  @IsString()
  @MinLength(1)
  token!: string;

  @ApiProperty({ minLength: 8, description: 'Минимум 8 символов' })
  @IsString()
  @MinLength(8, { message: 'Пароль должен быть не менее 8 символов' })
  password!: string;
}

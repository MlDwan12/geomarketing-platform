import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ format: 'email' })
  @IsEmail({}, { message: 'Некорректный email' })
  email!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  password!: string;
}

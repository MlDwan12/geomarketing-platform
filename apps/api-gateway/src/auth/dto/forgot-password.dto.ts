import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class ForgotPasswordDto {
  @ApiProperty({ format: 'email' })
  @IsEmail({}, { message: 'Некорректный email' })
  email!: string;
}

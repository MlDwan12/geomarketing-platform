import { ApiProperty } from '@nestjs/swagger';

// Форма ответа forgot-password — единственный эндпоинт, отдающий текстовое
// сообщение вместо данных (специально нейтральное, чтобы не палить наличие
// аккаунта по email — см. AuthController.forgotPassword).
export class SimpleMessageResponseDto {
  @ApiProperty()
  message!: string;
}

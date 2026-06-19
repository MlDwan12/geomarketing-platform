import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { Patterns } from '@geo/contracts';
import { PasswordResetService } from './password-reset.service';

@Controller()
export class PasswordResetController {
  constructor(private readonly passwordResetService: PasswordResetService) {}

  @MessagePattern(Patterns.PWD_RESET_CREATE)
  create(@Payload() payload: { email: string }) {
    return this.passwordResetService.createToken(payload.email);
  }

  @MessagePattern(Patterns.PWD_RESET_CONSUME)
  consume(@Payload() payload: { token: string; newPassword: string }) {
    return this.passwordResetService.consumeToken(payload.token, payload.newPassword);
  }
}

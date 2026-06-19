import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { Patterns } from '@geo/contracts';
import { UserService } from './user.service';

@Controller()
export class UserController {
  constructor(private readonly userService: UserService) {}

  @MessagePattern(Patterns.USER_VALIDATE)
  validate(@Payload() payload: { email: string; password: string }) {
    return this.userService.validate(payload.email, payload.password);
  }

  @MessagePattern(Patterns.USER_CREATE)
  create(@Payload() payload: { name: string; email: string; password: string; referralCode?: string }) {
    return this.userService.create(payload.name, payload.email, payload.password, payload.referralCode);
  }

  @MessagePattern(Patterns.USER_GET_PROFILE)
  getProfile(@Payload() payload: { userId: string }) {
    return this.userService.getProfile(payload.userId);
  }

  @MessagePattern(Patterns.USER_UPDATE_PROFILE)
  updateProfile(@Payload() payload: { userId: string; [key: string]: unknown }) {
    const { userId, ...dto } = payload;
    return this.userService.updateProfile(userId, dto as any);
  }

  @MessagePattern(Patterns.USER_UPDATE_AVATAR)
  updateAvatar(@Payload() payload: { userId: string; avatarUrl: string }) {
    return this.userService.updateAvatar(payload.userId, payload.avatarUrl);
  }

  @MessagePattern(Patterns.USER_CHANGE_PASSWORD)
  changePassword(@Payload() payload: { userId: string; currentPassword: string; newPassword: string }) {
    return this.userService.changePassword(payload.userId, payload.currentPassword, payload.newPassword);
  }
}

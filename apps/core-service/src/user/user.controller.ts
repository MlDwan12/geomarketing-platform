import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { Patterns } from '@geo/contracts';
import { UserService } from './user.service';
import { User } from './user.entity';

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
  updateProfile(
    @Payload()
    payload: {
      userId: string;
      name?: string;
      fullName?: string;
      phone?: string;
      telegram?: string;
      timezone?: string;
      locale?: string;
    },
  ) {
    const { userId, name, fullName, phone, telegram, timezone, locale } =
      payload;
    const dto: Partial<
      Pick<
        User,
        'name' | 'fullName' | 'phone' | 'telegram' | 'timezone' | 'locale'
      >
    > = {};
    if (name !== undefined) dto.name = name;
    if (fullName !== undefined) dto.fullName = fullName;
    if (phone !== undefined) dto.phone = phone;
    if (telegram !== undefined) dto.telegram = telegram;
    if (timezone !== undefined) dto.timezone = timezone;
    if (locale !== undefined) dto.locale = locale;
    return this.userService.updateProfile(userId, dto);
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

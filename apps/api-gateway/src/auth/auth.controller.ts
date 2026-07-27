import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Patch,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Patterns } from '@geo/contracts';
import { RpcExceptionFilter } from '../filters/rpc-exception.filter';
import { CurrentUser } from './decorators/current-user.decorator';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateAvatarDto } from './dto/update-avatar.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { SessionGuard } from './guards/session.guard';
import { sendRpc } from '../common/rpc';

@Controller('auth')
@UseFilters(RpcExceptionFilter)
export class AuthController {
  constructor(
    @Inject('CORE_SERVICE')
    private readonly coreClient: ClientProxy,
  ) {}

  @Post('login')
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async login(@Body() dto: LoginDto, @Req() req: any) {
    const user = await sendRpc(this.coreClient, Patterns.USER_VALIDATE, {
      email: dto.email,
      password: dto.password,
    });

    if (!user) {
      throw new UnauthorizedException('Неверный email или пароль');
    }

    req.session.userId = user.id;
    req.session.role = user.role;
    await new Promise<void>((resolve, reject) =>
      req.session.save((err: unknown) => (err ? reject(err) : resolve())),
    );

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatarUrl: user.avatarUrl ?? null,
      lastLoginAt: user.lastLoginAt,
    };
  }

  @Post('register')
  @HttpCode(201)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async register(@Body() dto: RegisterDto, @Req() req: any) {
    const user = await sendRpc(this.coreClient, Patterns.USER_CREATE, {
      name: dto.name,
      email: dto.email,
      password: dto.password,
      referralCode: dto.referralCode,
    });

    req.session.userId = user.id;
    req.session.role = user.role;
    await new Promise<void>((resolve, reject) =>
      req.session.save((err: unknown) => (err ? reject(err) : resolve())),
    );

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatarUrl: user.avatarUrl ?? null,
      lastLoginAt: user.lastLoginAt,
    };
  }

  @Post('forgot-password')
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    const token = await sendRpc(this.coreClient, Patterns.PWD_RESET_CREATE, {
      email: dto.email,
    });

    // TODO: заменить на отправку через mail-service.
    // Токен печатается только в non-production (в prod это утечка секрета).
    if (token && process.env.NODE_ENV !== 'production') {
      console.log(`[DEV] Password reset token: ${token}`);
    }

    return { message: 'Если аккаунт существует, письмо отправлено' };
  }

  @Post('reset-password')
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await sendRpc(this.coreClient, Patterns.PWD_RESET_CONSUME, {
      token: dto.token,
      newPassword: dto.password,
    });
    return {};
  }

  @Get('me')
  @UseGuards(SessionGuard)
  me(@CurrentUser() user: { userId: string; role: string }) {
    return sendRpc(this.coreClient, Patterns.USER_GET_PROFILE, {
      userId: user.userId,
    });
  }

  @Post('logout')
  @HttpCode(200)
  @UseGuards(SessionGuard)
  async logout(@Req() req: any, @Res({ passthrough: true }) res: any) {
    await new Promise<void>((resolve) => req.session.destroy(() => resolve()));
    res.clearCookie('connect.sid');
    return {};
  }

  @Patch('password')
  @HttpCode(200)
  @UseGuards(SessionGuard)
  async changePassword(
    @Body() dto: ChangePasswordDto,
    @CurrentUser() user: { userId: string },
  ) {
    await sendRpc(this.coreClient, Patterns.USER_CHANGE_PASSWORD, {
      userId: user.userId,
      currentPassword: dto.currentPassword,
      newPassword: dto.newPassword,
    });
    return {};
  }

  @Patch('profile')
  @UseGuards(SessionGuard)
  updateProfile(
    @Body() dto: UpdateProfileDto,
    @CurrentUser() user: { userId: string },
  ) {
    return sendRpc(this.coreClient, Patterns.USER_UPDATE_PROFILE, {
      userId: user.userId,
      ...dto,
    });
  }

  @Patch('avatar')
  @UseGuards(SessionGuard)
  updateAvatar(
    @Body() dto: UpdateAvatarDto,
    @CurrentUser() user: { userId: string },
  ) {
    return sendRpc(this.coreClient, Patterns.USER_UPDATE_AVATAR, {
      userId: user.userId,
      avatarUrl: dto.avatarUrl,
    });
  }
}

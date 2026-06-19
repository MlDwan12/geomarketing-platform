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
import { Patterns } from '@geo/contracts';
import { firstValueFrom, timeout } from 'rxjs';
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

const RPC_TIMEOUT = 5000;

@Controller('auth')
@UseFilters(RpcExceptionFilter)
export class AuthController {
  constructor(
    @Inject('CORE_SERVICE')
    private readonly coreClient: ClientProxy,
  ) {}

  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Req() req: any) {
    const user = await firstValueFrom(
      this.coreClient
        .send(Patterns.USER_VALIDATE, {
          email: dto.email,
          password: dto.password,
        })
        .pipe(timeout(RPC_TIMEOUT)),
    );

    if (!user) {
      throw new UnauthorizedException('Неверный email или пароль');
    }

    req.session.userId = user.id;
    req.session.role = user.role;

    return user;
  }

  @Post('register')
  @HttpCode(201)
  async register(@Body() dto: RegisterDto, @Req() req: any) {
    const user = await firstValueFrom(
      this.coreClient
        .send(Patterns.USER_CREATE, {
          name: dto.name,
          email: dto.email,
          password: dto.password,
          referralCode: dto.referralCode,
        })
        .pipe(timeout(RPC_TIMEOUT)),
    );

    req.session.userId = user.id;
    req.session.role = user.role;

    return user;
  }

  @Post('forgot-password')
  @HttpCode(200)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    const token = await firstValueFrom(
      this.coreClient
        .send(Patterns.PWD_RESET_CREATE, { email: dto.email })
        .pipe(timeout(RPC_TIMEOUT)),
    );

    // TODO: заменить на отправку через mail-service
    if (token) {
      console.log(`[DEV] Password reset token: ${token}`);
    }

    return { message: 'Если аккаунт существует, письмо отправлено' };
  }

  @Post('reset-password')
  @HttpCode(200)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await firstValueFrom(
      this.coreClient
        .send(Patterns.PWD_RESET_CONSUME, {
          token: dto.token,
          newPassword: dto.password,
        })
        .pipe(timeout(RPC_TIMEOUT)),
    );
    return {};
  }

  @Get('me')
  @UseGuards(SessionGuard)
  me(@CurrentUser() user: { userId: string; role: string }) {
    return firstValueFrom(
      this.coreClient
        .send(Patterns.USER_GET_PROFILE, { userId: user.userId })
        .pipe(timeout(RPC_TIMEOUT)),
    );
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
    await firstValueFrom(
      this.coreClient
        .send(Patterns.USER_CHANGE_PASSWORD, {
          userId: user.userId,
          currentPassword: dto.currentPassword,
          newPassword: dto.newPassword,
        })
        .pipe(timeout(RPC_TIMEOUT)),
    );
    return {};
  }

  @Patch('profile')
  @UseGuards(SessionGuard)
  updateProfile(
    @Body() dto: UpdateProfileDto,
    @CurrentUser() user: { userId: string },
  ) {
    return firstValueFrom(
      this.coreClient
        .send(Patterns.USER_UPDATE_PROFILE, { userId: user.userId, ...dto })
        .pipe(timeout(RPC_TIMEOUT)),
    );
  }

  @Patch('avatar')
  @UseGuards(SessionGuard)
  updateAvatar(
    @Body() dto: UpdateAvatarDto,
    @CurrentUser() user: { userId: string },
  ) {
    return firstValueFrom(
      this.coreClient
        .send(Patterns.USER_UPDATE_AVATAR, {
          userId: user.userId,
          avatarUrl: dto.avatarUrl,
        })
        .pipe(timeout(RPC_TIMEOUT)),
    );
  }
}

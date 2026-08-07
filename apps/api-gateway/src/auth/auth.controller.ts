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
import {
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Patterns } from '@geo/contracts';
import { LoggerService } from '@geo/logger';
import { RpcExceptionFilter } from '../filters/rpc-exception.filter';
import { CurrentUser } from './decorators/current-user.decorator';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateAvatarDto } from './dto/update-avatar.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { AuthUserSummaryResponseDto } from './dto/auth-user-summary-response.dto';
import { UserProfileResponseDto } from './dto/user-profile-response.dto';
import { SimpleMessageResponseDto } from './dto/simple-message-response.dto';
import { UpdateAvatarResponseDto } from './dto/update-avatar-response.dto';
import { SessionGuard } from './guards/session.guard';
import { sendRpc } from '../common/rpc';

@ApiTags('auth')
@Controller('auth')
@UseFilters(RpcExceptionFilter)
export class AuthController {
  constructor(
    @Inject('CORE_SERVICE')
    private readonly coreClient: ClientProxy,
    private readonly logger: LoggerService,
  ) {}

  @ApiOperation({
    summary: 'Вход по email/паролю',
    description:
      'При успехе создаёт серверную сессию (cookie `connect.sid`) — ' +
      'дальнейшие запросы авторизуются этой cookie, отдельный токен в ' +
      'ответе не возвращается. Лимит 10 попыток/мин на IP.',
  })
  @ApiResponse({ status: 200, type: AuthUserSummaryResponseDto })
  @ApiResponse({ status: 401, description: 'Неверный email или пароль' })
  @ApiResponse({ status: 429, description: 'Превышен лимит попыток (10/мин)' })
  @Post('login')
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    const user = await sendRpc(this.coreClient, Patterns.USER_VALIDATE, {
      email: dto.email,
      password: dto.password,
    });

    if (!user) {
      throw new UnauthorizedException('Неверный email или пароль');
    }

    req.session.userId = user.id;
    await new Promise<void>((resolve, reject) =>
      req.session.save((err: unknown) => (err ? reject(err) : resolve())),
    );

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl ?? null,
      lastLoginAt: user.lastLoginAt,
    };
  }

  @ApiOperation({
    summary: 'Регистрация нового пользователя',
    description:
      'Создаёт пользователя и сразу же сессию, как login. Бренд/компании ' +
      'создаются отдельно после регистрации.',
  })
  @ApiResponse({ status: 201, type: AuthUserSummaryResponseDto })
  @ApiResponse({ status: 429, description: 'Превышен лимит попыток (10/мин)' })
  @Post('register')
  @HttpCode(201)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async register(@Body() dto: RegisterDto, @Req() req: Request) {
    const user = await sendRpc(this.coreClient, Patterns.USER_CREATE, {
      name: dto.name,
      email: dto.email,
      password: dto.password,
      referralCode: dto.referralCode,
    });

    req.session.userId = user.id;
    await new Promise<void>((resolve, reject) =>
      req.session.save((err: unknown) => (err ? reject(err) : resolve())),
    );

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl ?? null,
      lastLoginAt: user.lastLoginAt,
    };
  }

  @ApiOperation({
    summary: 'Запросить сброс пароля',
    description:
      'Всегда отвечает одинаковым нейтральным сообщением независимо от ' +
      'того, существует ли email — чтобы не палить наличие аккаунта. ' +
      'Токен сброса сейчас не отправляется письмом (mail-service ещё нет) — ' +
      'в non-production печатается в лог сервера.',
  })
  @ApiResponse({ status: 200, type: SimpleMessageResponseDto })
  @ApiResponse({ status: 429, description: 'Превышен лимит попыток (10/мин)' })
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
      this.logger.log(`[DEV] Password reset token: ${token}`, 'AuthController');
    }

    return { message: 'Если аккаунт существует, письмо отправлено' };
  }

  @ApiOperation({ summary: 'Установить новый пароль по токену сброса' })
  @ApiResponse({
    status: 200,
    description: 'Пустой объект — пароль обновлён',
    schema: { type: 'object', example: {} },
  })
  @ApiResponse({ status: 400, description: 'Токен недействителен/истёк' })
  @ApiResponse({ status: 429, description: 'Превышен лимит попыток (10/мин)' })
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

  @ApiOperation({
    summary: 'Текущий залогиненный пользователь (полный профиль)',
  })
  @ApiCookieAuth()
  @ApiResponse({ status: 200, type: UserProfileResponseDto })
  @ApiResponse({ status: 401, description: 'Нет активной сессии' })
  @Get('me')
  @UseGuards(SessionGuard)
  me(@CurrentUser() user: { userId: string }) {
    return sendRpc(this.coreClient, Patterns.USER_GET_PROFILE, {
      userId: user.userId,
    });
  }

  @ApiOperation({ summary: 'Выход — уничтожает серверную сессию и cookie' })
  @ApiCookieAuth()
  @ApiResponse({
    status: 200,
    description: 'Пустой объект',
    schema: { type: 'object', example: {} },
  })
  @Post('logout')
  @HttpCode(200)
  @UseGuards(SessionGuard)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await new Promise<void>((resolve) => req.session.destroy(() => resolve()));
    res.clearCookie('connect.sid');
    return {};
  }

  @ApiOperation({ summary: 'Сменить пароль (зная текущий)' })
  @ApiCookieAuth()
  @ApiResponse({
    status: 200,
    description: 'Пустой объект',
    schema: { type: 'object', example: {} },
  })
  @ApiResponse({ status: 400, description: 'Неверный текущий пароль' })
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

  @ApiOperation({
    summary: 'Частично обновить профиль (только переданные поля)',
  })
  @ApiCookieAuth()
  @ApiResponse({ status: 200, type: UserProfileResponseDto })
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

  @ApiOperation({
    summary: 'Установить URL аватара',
    description:
      'Файл сначала загружается через POST /upload/logo, сюда передаётся только его URL.',
  })
  @ApiCookieAuth()
  @ApiResponse({ status: 200, type: UpdateAvatarResponseDto })
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

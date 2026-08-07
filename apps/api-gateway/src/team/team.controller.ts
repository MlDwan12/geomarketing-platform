import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Req,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import {
  ApiCookieAuth,
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { Patterns } from '@geo/contracts';
import { LoggerService } from '@geo/logger';
import { MailerNotConfiguredError, MailerService } from '@geo/mailer';
import { RpcExceptionFilter } from '../filters/rpc-exception.filter';
import { SessionGuard } from '../auth/guards/session.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { sendRpc } from '../common/rpc';
import { InviteMemberDto } from './dto/invite-member.dto';
import { ChangeMemberRoleDto } from './dto/change-member-role.dto';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';
import { SimpleMessageResponseDto } from '../auth/dto/simple-message-response.dto';
import { AcceptInvitationResponseDto } from './dto/accept-invitation-response.dto';
import {
  TeamInvitationResponseDto,
  TeamMemberResponseDto,
} from './dto/team-response.dto';

@ApiTags('team')
@Controller('team')
@UseFilters(RpcExceptionFilter)
export class TeamController {
  constructor(
    @Inject('CORE_SERVICE')
    private readonly coreClient: ClientProxy,
    private readonly logger: LoggerService,
    private readonly mailer: MailerService,
  ) {}

  @ApiOperation({ summary: 'Список участников бренда (доступен всем ролям)' })
  @ApiCookieAuth()
  @ApiHeader({ name: 'x-brand-id', required: true })
  @ApiResponse({ status: 200, type: TeamMemberResponseDto, isArray: true })
  @Get()
  @UseGuards(SessionGuard)
  listUsers(
    @Headers('x-brand-id') brandId: string,
    @CurrentUser() user: { userId: string },
  ) {
    return sendRpc(this.coreClient, Patterns.TEAM_LIST_USERS, {
      brandId,
      userId: user.userId,
    });
  }

  @ApiOperation({
    summary: 'Пригласить сотрудника (только Owner)',
    description:
      'Только для ещё не зарегистрированного email — приглашение становится ' +
      'регистрацией по ссылке (см. POST /team/invitations/accept). Доставка ' +
      'письма — TODO, пока токен печатается в лог сервера (non-production).',
  })
  @ApiCookieAuth()
  @ApiHeader({ name: 'x-brand-id', required: true })
  @ApiResponse({ status: 201, type: SimpleMessageResponseDto })
  @Post('invite')
  @HttpCode(201)
  @UseGuards(SessionGuard)
  async invite(
    @Headers('x-brand-id') brandId: string,
    @Body() dto: InviteMemberDto,
    @CurrentUser() user: { userId: string },
  ) {
    const { token } = await sendRpc(this.coreClient, Patterns.TEAM_INVITE, {
      brandId,
      userId: user.userId,
      email: dto.email,
      role: dto.role,
    });

    try {
      await this.mailer.sendTeamInvite(dto.email, token);
    } catch (err) {
      if (!(err instanceof MailerNotConfiguredError)) throw err;

      // RESEND_API_KEY ещё не задан (см. docs/refactor-plans/team-brand-roles.md)
      // — тот же dev-фолбэк, что у forgot-password, пока почта не подключена.
      if (process.env.NODE_ENV !== 'production') {
        this.logger.log(
          `[DEV] Mailer not configured. Team invitation token for ${dto.email}: ${token}`,
          'TeamController',
        );
      } else {
        throw err;
      }
    }

    return { message: 'Приглашение создано' };
  }

  @ApiOperation({ summary: 'Список приглашений бренда (только Owner)' })
  @ApiCookieAuth()
  @ApiHeader({ name: 'x-brand-id', required: true })
  @ApiResponse({ status: 200, type: TeamInvitationResponseDto, isArray: true })
  @Get('invitations')
  @UseGuards(SessionGuard)
  invitationList(
    @Headers('x-brand-id') brandId: string,
    @CurrentUser() user: { userId: string },
  ) {
    return sendRpc(this.coreClient, Patterns.TEAM_INVITATION_LIST, {
      brandId,
      userId: user.userId,
    });
  }

  @ApiOperation({ summary: 'Отозвать pending-приглашение (только Owner)' })
  @ApiCookieAuth()
  @ApiHeader({ name: 'x-brand-id', required: true })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Отозвано' })
  @Delete('invitations/:id')
  @HttpCode(204)
  @UseGuards(SessionGuard)
  revokeInvitation(
    @Param('id') invitationId: string,
    @Headers('x-brand-id') brandId: string,
    @CurrentUser() user: { userId: string },
  ) {
    return sendRpc(this.coreClient, Patterns.TEAM_INVITATION_REVOKE, {
      invitationId,
      brandId,
      userId: user.userId,
    });
  }

  @ApiOperation({ summary: 'Сменить роль участника (только Owner)' })
  @ApiCookieAuth()
  @ApiHeader({ name: 'x-brand-id', required: true })
  @ApiParam({ name: 'userId', format: 'uuid' })
  @ApiResponse({ status: 200, type: TeamMemberResponseDto })
  @Patch('members/:userId')
  @UseGuards(SessionGuard)
  changeMemberRole(
    @Param('userId') targetUserId: string,
    @Headers('x-brand-id') brandId: string,
    @Body() dto: ChangeMemberRoleDto,
    @CurrentUser() user: { userId: string },
  ) {
    return sendRpc(this.coreClient, Patterns.TEAM_MEMBER_UPDATE_ROLE, {
      brandId,
      callerId: user.userId,
      targetUserId,
      role: dto.role,
    });
  }

  @ApiOperation({ summary: 'Удалить участника из бренда (только Owner)' })
  @ApiCookieAuth()
  @ApiHeader({ name: 'x-brand-id', required: true })
  @ApiParam({ name: 'userId', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Удалён' })
  @Delete('members/:userId')
  @HttpCode(204)
  @UseGuards(SessionGuard)
  removeMember(
    @Param('userId') targetUserId: string,
    @Headers('x-brand-id') brandId: string,
    @CurrentUser() user: { userId: string },
  ) {
    return sendRpc(this.coreClient, Patterns.TEAM_MEMBER_REMOVE, {
      brandId,
      callerId: user.userId,
      targetUserId,
    });
  }

  @ApiOperation({
    summary: 'Принять приглашение по токену (регистрация, без сессии)',
    description:
      'Создаёт пользователя и сразу же сессию, как /auth/register. Лимит ' +
      '10 попыток/мин на IP — токен угадываемый секрет, как password-reset.',
  })
  @ApiResponse({ status: 201, type: AcceptInvitationResponseDto })
  @ApiResponse({ status: 400, description: 'Токен недействителен/истёк' })
  @ApiResponse({ status: 429, description: 'Превышен лимит попыток (10/мин)' })
  @Post('invitations/accept')
  @HttpCode(201)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async acceptInvitation(
    @Body() dto: AcceptInvitationDto,
    @Req() req: Request,
  ) {
    const result = await sendRpc(
      this.coreClient,
      Patterns.TEAM_INVITATION_ACCEPT,
      dto,
    );

    req.session.userId = result.userId;
    await new Promise<void>((resolve, reject) =>
      req.session.save((err: unknown) => (err ? reject(err) : resolve())),
    );

    return result;
  }
}

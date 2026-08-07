import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { Patterns } from '@geo/contracts';
import { TeamService } from './team.service';
import { BrandRole } from '../brand/user-brand.entity';

@Controller()
export class TeamController {
  constructor(private readonly teamService: TeamService) {}

  @MessagePattern(Patterns.TEAM_LIST_USERS)
  listUsers(
    @Payload() { brandId, userId }: { brandId: string; userId: string },
  ) {
    return this.teamService.listUsers(brandId, userId);
  }

  @MessagePattern(Patterns.TEAM_INVITE)
  invite(
    @Payload()
    dto: {
      brandId: string;
      userId: string;
      email: string;
      role: BrandRole;
    },
  ) {
    return this.teamService.invite(dto);
  }

  @MessagePattern(Patterns.TEAM_INVITATION_LIST)
  invitationList(
    @Payload() { brandId, userId }: { brandId: string; userId: string },
  ) {
    return this.teamService.invitationList(brandId, userId);
  }

  @MessagePattern(Patterns.TEAM_MEMBER_UPDATE_ROLE)
  changeMemberRole(
    @Payload()
    {
      brandId,
      callerId,
      targetUserId,
      role,
    }: {
      brandId: string;
      callerId: string;
      targetUserId: string;
      role: BrandRole;
    },
  ) {
    return this.teamService.changeMemberRole(
      brandId,
      callerId,
      targetUserId,
      role,
    );
  }

  @MessagePattern(Patterns.TEAM_MEMBER_REMOVE)
  removeMember(
    @Payload()
    {
      brandId,
      callerId,
      targetUserId,
    }: {
      brandId: string;
      callerId: string;
      targetUserId: string;
    },
  ) {
    return this.teamService.removeMember(brandId, callerId, targetUserId);
  }

  @MessagePattern(Patterns.TEAM_INVITATION_ACCEPT)
  acceptInvitation(
    @Payload() dto: { token: string; name: string; password: string },
  ) {
    return this.teamService.acceptInvitation(dto);
  }

  @MessagePattern(Patterns.TEAM_INVITATION_REVOKE)
  revoke(
    @Payload()
    {
      invitationId,
      brandId,
      userId,
    }: {
      invitationId: string;
      brandId: string;
      userId: string;
    },
  ) {
    return this.teamService.revoke(invitationId, brandId, userId);
  }
}

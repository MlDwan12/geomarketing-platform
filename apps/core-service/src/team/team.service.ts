import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, MoreThan, Repository } from 'typeorm';
import { RpcException } from '@nestjs/microservices';
import { createHash, randomBytes } from 'crypto';
import { BrandRole, UserBrand } from '../brand/user-brand.entity';
import { User, UserStatus } from '../user/user.entity';
import { UserService } from '../user/user.service';
import { TeamInvitation, TeamInvitationStatus } from './team-invitation.entity';
import { hasMinRole } from '../common/brand-role.util';

const INVITATION_TTL_DAYS = 7;

@Injectable()
export class TeamService {
  constructor(
    @InjectRepository(UserBrand)
    private readonly userBrandRepo: Repository<UserBrand>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(TeamInvitation)
    private readonly invitationRepo: Repository<TeamInvitation>,
    private readonly userService: UserService,
  ) {}

  async listUsers(brandId: string, userId: string) {
    await this.assertBrandAccess(brandId, userId);

    const memberships = await this.userBrandRepo.find({
      where: { brandId },
      order: { joinedAt: 'ASC' },
    });
    if (!memberships.length) return [];

    const users = await this.userRepo.find({
      where: { id: In(memberships.map((m) => m.userId)) },
    });
    const userById = new Map(users.map((u) => [u.id, u]));

    return memberships.map((m) => {
      const user = userById.get(m.userId);
      return {
        userId: m.userId,
        name: user?.name ?? null,
        email: user?.email ?? null,
        avatarUrl: user?.avatarUrl ?? null,
        role: m.role,
        status: m.status,
        joinedAt: m.joinedAt,
        lastLoginAt: m.lastLoginAt,
      };
    });
  }

  // Возвращает сырой токен один раз (не хранится) — доставка (Resend) в
  // следующих коммитах плана, пока вызывающий сам решает, что с ним делать.
  async invite(dto: {
    brandId: string;
    userId: string;
    email: string;
    role: BrandRole;
  }): Promise<{ invitation: TeamInvitation; token: string }> {
    await this.assertBrandAccess(dto.brandId, dto.userId, BrandRole.Owner);

    if (dto.role === BrandRole.Owner) {
      throw new RpcException({
        status: 400,
        message: 'Cannot invite as Owner — Owner is unique per Brand',
      });
    }

    const existingUser = await this.userRepo.findOne({
      where: { email: dto.email },
    });
    if (existingUser) {
      const existingMembership = await this.userBrandRepo.findOne({
        where: { brandId: dto.brandId, userId: existingUser.id },
      });
      if (existingMembership) {
        throw new RpcException({
          status: 409,
          message: 'User is already a member of this brand',
        });
      }
    }

    const existingInvite = await this.invitationRepo.findOne({
      where: {
        brandId: dto.brandId,
        email: dto.email,
        status: TeamInvitationStatus.Pending,
      },
    });
    if (existingInvite) {
      throw new RpcException({
        status: 409,
        message: 'This email already has a pending invitation',
      });
    }

    const token = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + INVITATION_TTL_DAYS);

    const invitation = await this.invitationRepo.save(
      this.invitationRepo.create({
        brandId: dto.brandId,
        email: dto.email,
        role: dto.role,
        invitedByUserId: dto.userId,
        tokenHash,
        expiresAt,
      }),
    );

    return { invitation, token };
  }

  async invitationList(brandId: string, userId: string) {
    await this.assertBrandAccess(brandId, userId, BrandRole.Owner);
    return this.invitationRepo.find({
      where: { brandId },
      order: { createdAt: 'DESC' },
    });
  }

  async revoke(
    invitationId: string,
    brandId: string,
    userId: string,
  ): Promise<null> {
    await this.assertBrandAccess(brandId, userId, BrandRole.Owner);

    const invitation = await this.invitationRepo.findOne({
      where: { id: invitationId },
    });
    if (!invitation || invitation.brandId !== brandId) {
      throw new RpcException({ status: 404, message: 'Invitation not found' });
    }
    if (invitation.status !== TeamInvitationStatus.Pending) {
      throw new RpcException({
        status: 400,
        message: 'Only a pending invitation can be revoked',
      });
    }

    invitation.status = TeamInvitationStatus.Revoked;
    await this.invitationRepo.save(invitation);
    return null;
  }

  async changeMemberRole(
    brandId: string,
    callerId: string,
    targetUserId: string,
    role: BrandRole,
  ): Promise<UserBrand> {
    await this.assertBrandAccess(brandId, callerId, BrandRole.Owner);

    if (role === BrandRole.Owner) {
      throw new RpcException({
        status: 400,
        message:
          'Cannot assign Owner role — ownership transfer is not supported',
      });
    }

    const membership = await this.userBrandRepo.findOne({
      where: { brandId, userId: targetUserId },
    });
    if (!membership) {
      throw new RpcException({ status: 404, message: 'Member not found' });
    }
    if (membership.role === BrandRole.Owner) {
      throw new RpcException({
        status: 400,
        message: 'Cannot change the Owner role',
      });
    }

    membership.role = role;
    return this.userBrandRepo.save(membership);
  }

  async removeMember(
    brandId: string,
    callerId: string,
    targetUserId: string,
  ): Promise<null> {
    await this.assertBrandAccess(brandId, callerId, BrandRole.Owner);

    const membership = await this.userBrandRepo.findOne({
      where: { brandId, userId: targetUserId },
    });
    if (!membership) {
      throw new RpcException({ status: 404, message: 'Member not found' });
    }
    if (membership.role === BrandRole.Owner) {
      throw new RpcException({
        status: 400,
        message: 'Cannot remove the Owner from a Brand',
      });
    }

    await this.userBrandRepo.remove(membership);
    return null;
  }

  // Публичный флоу — вызывающий ещё не аутентифицирован, это и есть
  // регистрация (см. CONTEXT.md: инвайт только для незарегистрированных
  // email). Без assertBrandAccess — тут ещё нет членства в бренде.
  async acceptInvitation(dto: {
    token: string;
    name: string;
    password: string;
  }): Promise<{ userId: string; brandId: string; role: BrandRole }> {
    const tokenHash = createHash('sha256').update(dto.token).digest('hex');

    const invitation = await this.invitationRepo.findOne({
      where: {
        tokenHash,
        status: TeamInvitationStatus.Pending,
        expiresAt: MoreThan(new Date()),
      },
    });

    if (!invitation) {
      throw new RpcException({
        status: 400,
        message: 'Invitation is invalid, expired, or already used',
      });
    }

    const user = await this.userService.create(
      dto.name,
      invitation.email,
      dto.password,
    );

    await this.userBrandRepo.save(
      this.userBrandRepo.create({
        userId: user.id,
        brandId: invitation.brandId,
        role: invitation.role,
        status: UserStatus.Active,
        lastLoginAt: null,
      }),
    );

    invitation.status = TeamInvitationStatus.Accepted;
    await this.invitationRepo.save(invitation);

    return {
      userId: user.id,
      brandId: invitation.brandId,
      role: invitation.role,
    };
  }

  private async assertBrandAccess(
    brandId: string,
    userId: string,
    minRole: BrandRole = BrandRole.Viewer,
  ): Promise<void> {
    const membership = await this.userBrandRepo.findOne({
      where: { brandId, userId },
    });

    if (!membership || !hasMinRole(membership.role, minRole)) {
      throw new RpcException({ status: 403, message: 'Forbidden' });
    }
  }
}

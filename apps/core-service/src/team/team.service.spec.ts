import { Repository } from 'typeorm';
import { RpcException } from '@nestjs/microservices';
import { TeamService } from './team.service';
import { BrandRole, UserBrand } from '../brand/user-brand.entity';
import { User, UserStatus } from '../user/user.entity';
import { UserService } from '../user/user.service';
import { TeamInvitation, TeamInvitationStatus } from './team-invitation.entity';

function fakeUserService() {
  const create = jest.fn();
  const service = { create } as unknown as UserService;
  return { service, create };
}

function fakeUserBrandRepo(rows: Partial<UserBrand>[]) {
  const findOne = jest
    .fn()
    .mockImplementation(({ where }: { where: Partial<UserBrand> }) =>
      Promise.resolve(
        rows.find(
          (r) => r.brandId === where.brandId && r.userId === where.userId,
        ) ?? null,
      ),
    );
  const find = jest.fn().mockResolvedValue(rows);
  const create = jest.fn().mockImplementation((m: Partial<UserBrand>) => m);
  const save = jest
    .fn()
    .mockImplementation((m: Partial<UserBrand>) => Promise.resolve(m));
  const remove = jest.fn().mockResolvedValue(undefined);
  const repo = {
    findOne,
    find,
    create,
    save,
    remove,
  } as unknown as Repository<UserBrand>;
  return { repo, findOne, find, create, save, remove };
}

function fakeUserRepo(users: Partial<User>[] = []) {
  const findOne = jest
    .fn()
    .mockImplementation(({ where }: { where: { email?: string } }) =>
      Promise.resolve(users.find((u) => u.email === where.email) ?? null),
    );
  const find = jest.fn().mockResolvedValue(users);
  const repo = { findOne, find } as unknown as Repository<User>;
  return { repo, findOne, find };
}

function fakeInvitationRepo(existing: Partial<TeamInvitation> | null = null) {
  const create = jest
    .fn()
    .mockImplementation((e: Partial<TeamInvitation>) => e);
  const save = jest.fn().mockImplementation((e: Partial<TeamInvitation>) => ({
    id: 'inv-1',
    ...e,
  }));
  const findOne = jest.fn().mockResolvedValue(existing);
  const find = jest.fn().mockResolvedValue(existing ? [existing] : []);
  const repo = {
    create,
    save,
    findOne,
    find,
  } as unknown as Repository<TeamInvitation>;
  return { repo, create, save, findOne, find };
}

describe('TeamService', () => {
  describe('listUsers', () => {
    it('доступен участнику с ролью Viewer', async () => {
      const userBrand = fakeUserBrandRepo([
        {
          brandId: 'brand-1',
          userId: 'user-1',
          role: BrandRole.Viewer,
          status: UserStatus.Active,
          joinedAt: new Date('2026-01-01'),
          lastLoginAt: null,
        },
      ]);
      const userRepo = fakeUserRepo([
        { id: 'user-1', name: 'Аня', email: 'anya@example.com' },
      ]);
      const service = new TeamService(
        userBrand.repo,
        userRepo.repo,
        fakeInvitationRepo().repo,
        fakeUserService().service,
      );

      const result = await service.listUsers('brand-1', 'user-1');

      expect(result).toEqual([
        expect.objectContaining({ userId: 'user-1', name: 'Аня' }),
      ]);
    });

    it('без членства в бренде — 403', async () => {
      const userBrand = fakeUserBrandRepo([]);
      const service = new TeamService(
        userBrand.repo,
        fakeUserRepo().repo,
        fakeInvitationRepo().repo,
        fakeUserService().service,
      );

      await expect(service.listUsers('brand-1', 'stranger')).rejects.toThrow(
        RpcException,
      );
    });
  });

  describe('invite', () => {
    it('Owner может пригласить новый email с ролью Manager', async () => {
      const userBrand = fakeUserBrandRepo([
        { brandId: 'brand-1', userId: 'owner-1', role: BrandRole.Owner },
      ]);
      const invitationRepo = fakeInvitationRepo(null);
      const service = new TeamService(
        userBrand.repo,
        fakeUserRepo([]).repo,
        invitationRepo.repo,
        fakeUserService().service,
      );

      const result = await service.invite({
        brandId: 'brand-1',
        userId: 'owner-1',
        email: 'new@example.com',
        role: BrandRole.Manager,
      });

      expect(result.token).toHaveLength(64);
      expect(invitationRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'new@example.com',
          role: BrandRole.Manager,
        }),
      );
    });

    it('Manager не может приглашать (нужен Owner)', async () => {
      const userBrand = fakeUserBrandRepo([
        { brandId: 'brand-1', userId: 'manager-1', role: BrandRole.Manager },
      ]);
      const service = new TeamService(
        userBrand.repo,
        fakeUserRepo([]).repo,
        fakeInvitationRepo(null).repo,
        fakeUserService().service,
      );

      await expect(
        service.invite({
          brandId: 'brand-1',
          userId: 'manager-1',
          email: 'new@example.com',
          role: BrandRole.Viewer,
        }),
      ).rejects.toThrow(RpcException);
    });

    it('нельзя пригласить с ролью Owner', async () => {
      const userBrand = fakeUserBrandRepo([
        { brandId: 'brand-1', userId: 'owner-1', role: BrandRole.Owner },
      ]);
      const service = new TeamService(
        userBrand.repo,
        fakeUserRepo([]).repo,
        fakeInvitationRepo(null).repo,
        fakeUserService().service,
      );

      await expect(
        service.invite({
          brandId: 'brand-1',
          userId: 'owner-1',
          email: 'new@example.com',
          role: BrandRole.Owner,
        }),
      ).rejects.toThrow(RpcException);
    });

    it('нельзя пригласить email, который уже состоит в бренде', async () => {
      const userBrand = fakeUserBrandRepo([
        { brandId: 'brand-1', userId: 'owner-1', role: BrandRole.Owner },
        { brandId: 'brand-1', userId: 'existing-1', role: BrandRole.Viewer },
      ]);
      const userRepo = fakeUserRepo([
        { id: 'existing-1', email: 'already@example.com' },
      ]);
      const service = new TeamService(
        userBrand.repo,
        userRepo.repo,
        fakeInvitationRepo(null).repo,
        fakeUserService().service,
      );

      await expect(
        service.invite({
          brandId: 'brand-1',
          userId: 'owner-1',
          email: 'already@example.com',
          role: BrandRole.Viewer,
        }),
      ).rejects.toThrow(RpcException);
    });

    it('нельзя дублировать pending-инвайт на тот же email', async () => {
      const userBrand = fakeUserBrandRepo([
        { brandId: 'brand-1', userId: 'owner-1', role: BrandRole.Owner },
      ]);
      const invitationRepo = fakeInvitationRepo({
        brandId: 'brand-1',
        email: 'pending@example.com',
        status: TeamInvitationStatus.Pending,
      });
      const service = new TeamService(
        userBrand.repo,
        fakeUserRepo([]).repo,
        invitationRepo.repo,
        fakeUserService().service,
      );

      await expect(
        service.invite({
          brandId: 'brand-1',
          userId: 'owner-1',
          email: 'pending@example.com',
          role: BrandRole.Viewer,
        }),
      ).rejects.toThrow(RpcException);
    });
  });

  describe('invitationList', () => {
    it('требует BrandRole.Owner', async () => {
      const userBrand = fakeUserBrandRepo([
        { brandId: 'brand-1', userId: 'manager-1', role: BrandRole.Manager },
      ]);
      const service = new TeamService(
        userBrand.repo,
        fakeUserRepo([]).repo,
        fakeInvitationRepo(null).repo,
        fakeUserService().service,
      );

      await expect(
        service.invitationList('brand-1', 'manager-1'),
      ).rejects.toThrow(RpcException);
    });
  });

  describe('changeMemberRole', () => {
    it('Owner может сменить роль обычного участника', async () => {
      const userBrand = fakeUserBrandRepo([
        { brandId: 'brand-1', userId: 'owner-1', role: BrandRole.Owner },
        { brandId: 'brand-1', userId: 'target-1', role: BrandRole.Viewer },
      ]);
      const service = new TeamService(
        userBrand.repo,
        fakeUserRepo([]).repo,
        fakeInvitationRepo(null).repo,
        fakeUserService().service,
      );

      const result = await service.changeMemberRole(
        'brand-1',
        'owner-1',
        'target-1',
        BrandRole.Manager,
      );

      expect(result.role).toBe(BrandRole.Manager);
    });

    it('нельзя назначить роль Owner через смену роли', async () => {
      const userBrand = fakeUserBrandRepo([
        { brandId: 'brand-1', userId: 'owner-1', role: BrandRole.Owner },
        { brandId: 'brand-1', userId: 'target-1', role: BrandRole.Viewer },
      ]);
      const service = new TeamService(
        userBrand.repo,
        fakeUserRepo([]).repo,
        fakeInvitationRepo(null).repo,
        fakeUserService().service,
      );

      await expect(
        service.changeMemberRole(
          'brand-1',
          'owner-1',
          'target-1',
          BrandRole.Owner,
        ),
      ).rejects.toThrow(RpcException);
    });

    it('нельзя сменить роль самого Owner', async () => {
      const userBrand = fakeUserBrandRepo([
        { brandId: 'brand-1', userId: 'owner-1', role: BrandRole.Owner },
      ]);
      const service = new TeamService(
        userBrand.repo,
        fakeUserRepo([]).repo,
        fakeInvitationRepo(null).repo,
        fakeUserService().service,
      );

      await expect(
        service.changeMemberRole(
          'brand-1',
          'owner-1',
          'owner-1',
          BrandRole.Manager,
        ),
      ).rejects.toThrow(RpcException);
    });

    it('Manager не может менять роли (нужен Owner)', async () => {
      const userBrand = fakeUserBrandRepo([
        { brandId: 'brand-1', userId: 'manager-1', role: BrandRole.Manager },
        { brandId: 'brand-1', userId: 'target-1', role: BrandRole.Viewer },
      ]);
      const service = new TeamService(
        userBrand.repo,
        fakeUserRepo([]).repo,
        fakeInvitationRepo(null).repo,
        fakeUserService().service,
      );

      await expect(
        service.changeMemberRole(
          'brand-1',
          'manager-1',
          'target-1',
          BrandRole.Manager,
        ),
      ).rejects.toThrow(RpcException);
    });
  });

  describe('removeMember', () => {
    it('Owner может удалить обычного участника', async () => {
      const userBrand = fakeUserBrandRepo([
        { brandId: 'brand-1', userId: 'owner-1', role: BrandRole.Owner },
        { brandId: 'brand-1', userId: 'target-1', role: BrandRole.Viewer },
      ]);
      const service = new TeamService(
        userBrand.repo,
        fakeUserRepo([]).repo,
        fakeInvitationRepo(null).repo,
        fakeUserService().service,
      );

      await service.removeMember('brand-1', 'owner-1', 'target-1');

      expect(userBrand.remove).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'target-1' }),
      );
    });

    it('нельзя удалить Owner из бренда', async () => {
      const userBrand = fakeUserBrandRepo([
        { brandId: 'brand-1', userId: 'owner-1', role: BrandRole.Owner },
      ]);
      const service = new TeamService(
        userBrand.repo,
        fakeUserRepo([]).repo,
        fakeInvitationRepo(null).repo,
        fakeUserService().service,
      );

      await expect(
        service.removeMember('brand-1', 'owner-1', 'owner-1'),
      ).rejects.toThrow(RpcException);
      expect(userBrand.remove).not.toHaveBeenCalled();
    });
  });

  describe('revoke', () => {
    it('Owner может отозвать pending-инвайт', async () => {
      const userBrand = fakeUserBrandRepo([
        { brandId: 'brand-1', userId: 'owner-1', role: BrandRole.Owner },
      ]);
      const invitationRepo = fakeInvitationRepo({
        id: 'inv-1',
        brandId: 'brand-1',
        status: TeamInvitationStatus.Pending,
      });
      const service = new TeamService(
        userBrand.repo,
        fakeUserRepo([]).repo,
        invitationRepo.repo,
        fakeUserService().service,
      );

      await service.revoke('inv-1', 'brand-1', 'owner-1');

      expect(invitationRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: TeamInvitationStatus.Revoked }),
      );
    });

    it('нельзя отозвать уже принятый/отозванный инвайт', async () => {
      const userBrand = fakeUserBrandRepo([
        { brandId: 'brand-1', userId: 'owner-1', role: BrandRole.Owner },
      ]);
      const invitationRepo = fakeInvitationRepo({
        id: 'inv-1',
        brandId: 'brand-1',
        status: TeamInvitationStatus.Accepted,
      });
      const service = new TeamService(
        userBrand.repo,
        fakeUserRepo([]).repo,
        invitationRepo.repo,
        fakeUserService().service,
      );

      await expect(
        service.revoke('inv-1', 'brand-1', 'owner-1'),
      ).rejects.toThrow(RpcException);
    });
  });

  describe('acceptInvitation', () => {
    it('создаёт пользователя и членство в бренде по валидному токену', async () => {
      const userBrand = fakeUserBrandRepo([]);
      const invitationRepo = fakeInvitationRepo({
        id: 'inv-1',
        brandId: 'brand-1',
        email: 'new@example.com',
        role: BrandRole.Viewer,
        status: TeamInvitationStatus.Pending,
      });
      const userService = fakeUserService();
      userService.create.mockResolvedValue({
        id: 'user-2',
        name: 'Иван',
        email: 'new@example.com',
      });
      const service = new TeamService(
        userBrand.repo,
        fakeUserRepo([]).repo,
        invitationRepo.repo,
        userService.service,
      );

      const result = await service.acceptInvitation({
        token: 'raw-token',
        name: 'Иван',
        password: 'secret123',
      });

      expect(userService.create).toHaveBeenCalledWith(
        'Иван',
        'new@example.com',
        'secret123',
      );
      expect(userBrand.save).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-2',
          brandId: 'brand-1',
          role: BrandRole.Viewer,
        }),
      );
      expect(invitationRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: TeamInvitationStatus.Accepted }),
      );
      expect(result).toEqual({
        userId: 'user-2',
        brandId: 'brand-1',
        role: BrandRole.Viewer,
      });
    });

    it('невалидный/просроченный/уже использованный токен — 400, пользователь не создаётся', async () => {
      const userBrand = fakeUserBrandRepo([]);
      const invitationRepo = fakeInvitationRepo(null);
      const userService = fakeUserService();
      const service = new TeamService(
        userBrand.repo,
        fakeUserRepo([]).repo,
        invitationRepo.repo,
        userService.service,
      );

      await expect(
        service.acceptInvitation({
          token: 'bad-token',
          name: 'Иван',
          password: 'secret123',
        }),
      ).rejects.toThrow(RpcException);
      expect(userService.create).not.toHaveBeenCalled();
      expect(userBrand.save).not.toHaveBeenCalled();
    });
  });
});

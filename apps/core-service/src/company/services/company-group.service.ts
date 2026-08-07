import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, ILike, In, Repository } from 'typeorm';
import { RpcException } from '@nestjs/microservices';
import { Company } from '../entities/company.entity';
import { CompanyGroup } from '../entities/company-group.entity';
import { CompanyGroupMember } from '../entities/company-group-member.entity';
import { CompanyAccessService } from './company-access.service';
import { BrandRole } from '../../brand/user-brand.entity';

@Injectable()
export class CompanyGroupService {
  constructor(
    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,
    @InjectRepository(CompanyGroup)
    private readonly groupRepo: Repository<CompanyGroup>,
    @InjectRepository(CompanyGroupMember)
    private readonly groupMemberRepo: Repository<CompanyGroupMember>,
    private readonly dataSource: DataSource,
    private readonly access: CompanyAccessService,
  ) {}

  async listGroups(brandId: string, userId: string, search?: string) {
    await this.access.assertBrandAccess(brandId, userId);
    const groups = await this.groupRepo.find({
      where: { brandId, ...(search ? { name: ILike(`%${search}%`) } : {}) },
      order: { createdAt: 'ASC' },
    });
    return groups.map((g) => ({ id: g.id, name: g.name }));
  }

  async listGroupsStats(userId: string, brandId: string, search?: string) {
    await this.access.assertBrandAccess(brandId, userId);

    const params: unknown[] = [brandId];
    let searchClause = '';

    if (search) {
      params.push(`%${search}%`);
      searchClause = `AND g.name ILIKE $${params.length}`;
    }

    const rows: {
      id: string;
      name: string;
      brandId: string;
      companiesCount: string;
    }[] = await this.dataSource.query(
      `SELECT g.id, g.name, g."brandId", COUNT(m."companyId")::int AS "companiesCount"
         FROM company_groups g
         LEFT JOIN company_group_members m ON m."groupId" = g.id
         WHERE g."brandId" = $1 ${searchClause}
         GROUP BY g.id
         ORDER BY g."createdAt" ASC`,
      params,
    );

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      brandId: r.brandId,
      companiesCount: Number(r.companiesCount),
    }));
  }

  async removeCompaniesFromGroup(
    groupId: string,
    userId: string,
    companyIds: string[],
    brandId: string,
  ) {
    const group = await this.getGroupOrThrow(groupId);
    if (group.brandId !== brandId)
      throw new RpcException({ status: 404, message: 'Group not found' });
    await this.access.assertBrandAccess(brandId, userId, BrandRole.Manager);

    if (!companyIds.length) return { groupId, removed: 0 };

    await this.groupMemberRepo.delete({ groupId, companyId: In(companyIds) });
    return { groupId, removed: companyIds.length };
  }

  async addCompaniesToGroup(
    groupId: string,
    userId: string,
    companyIds: string[],
    brandId: string,
  ) {
    const group = await this.getGroupOrThrow(groupId);
    if (group.brandId !== brandId)
      throw new RpcException({ status: 404, message: 'Group not found' });
    await this.access.assertBrandAccess(brandId, userId, BrandRole.Manager);

    if (!companyIds.length) return { groupId, added: 0 };

    const valid = await this.companyRepo.find({
      where: { id: In(companyIds), brandId: group.brandId },
    });
    if (valid.length !== companyIds.length) {
      throw new RpcException({
        status: 400,
        message: 'One or more company IDs are invalid',
      });
    }

    await this.dataSource
      .createQueryBuilder()
      .insert()
      .into(CompanyGroupMember)
      .values(companyIds.map((companyId) => ({ groupId, companyId })))
      .orIgnore()
      .execute();

    return { groupId, added: companyIds.length };
  }

  async getGroup(groupId: string, userId: string, brandId: string) {
    const group = await this.getGroupOrThrow(groupId);
    if (group.brandId !== brandId)
      throw new RpcException({ status: 404, message: 'Group not found' });
    await this.access.assertBrandAccess(brandId, userId);

    const members = await this.groupMemberRepo.find({ where: { groupId } });
    const companies = members.length
      ? await this.companyRepo.find({
          where: { id: In(members.map((m) => m.companyId)) },
        })
      : [];

    return {
      id: group.id,
      name: group.name,
      companiesCount: companies.length,
      companies: companies.map((c) => ({ id: c.id, name: c.name })),
    };
  }

  async createGroup(dto: { brandId: string; userId: string; name: string }) {
    await this.access.assertBrandAccess(
      dto.brandId,
      dto.userId,
      BrandRole.Manager,
    );
    return this.groupRepo.save(
      this.groupRepo.create({ brandId: dto.brandId, name: dto.name }),
    );
  }

  async updateGroup(
    groupId: string,
    userId: string,
    name: string,
    brandId: string,
  ) {
    const group = await this.getGroupOrThrow(groupId);
    if (group.brandId !== brandId)
      throw new RpcException({ status: 404, message: 'Group not found' });
    await this.access.assertBrandAccess(brandId, userId, BrandRole.Manager);
    group.name = name;
    return this.groupRepo.save(group);
  }

  async deleteGroup(groupId: string, userId: string, brandId: string) {
    const group = await this.getGroupOrThrow(groupId);
    if (group.brandId !== brandId)
      throw new RpcException({ status: 404, message: 'Group not found' });
    await this.access.assertBrandAccess(brandId, userId, BrandRole.Manager);
    await this.groupRepo.remove(group);
    return null;
  }

  async updateCompanyGroups(
    companyId: string,
    userId: string,
    groupIds: string[],
    brandId: string,
  ) {
    const company = await this.access.getCompanyOrThrow(companyId);
    if (company.brandId !== brandId)
      throw new RpcException({ status: 404, message: 'Company not found' });
    await this.access.assertBrandAccess(brandId, userId, BrandRole.Manager);

    if (groupIds.length) {
      const validGroups = await this.groupRepo.find({
        where: { id: In(groupIds), brandId: company.brandId },
      });
      if (validGroups.length !== groupIds.length) {
        throw new RpcException({
          status: 400,
          message: 'One or more group IDs are invalid',
        });
      }
    }

    return this.dataSource.transaction(async (em) => {
      await em.delete(CompanyGroupMember, { companyId });
      if (groupIds.length) {
        await em.save(
          groupIds.map((groupId) =>
            em.create(CompanyGroupMember, { groupId, companyId }),
          ),
        );
      }
      return { companyId, groupIds };
    });
  }

  private async getGroupOrThrow(groupId: string): Promise<CompanyGroup> {
    const group = await this.groupRepo.findOne({ where: { id: groupId } });
    if (!group)
      throw new RpcException({ status: 404, message: 'Group not found' });
    return group;
  }
}

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Not, Repository } from 'typeorm';
import { RpcException } from '@nestjs/microservices';
import { Paginated } from '@geo/contracts';
import { Company, CompanyStatus } from './company.entity';
import { CompanyDefault, FieldOverrides } from './company-default.entity';
import { CompanyTemplate } from './company-template.entity';
import { CompanyPlatform, PlatformStatus } from './company-platform.entity';
import { CompanyGroup } from './company-group.entity';
import { CompanyGroupMember } from './company-group-member.entity';
import {
  assembleCardFields as assembleCardFieldsFn,
  resolveForPlatform as resolveForPlatformFn,
} from './card-fields';
import { slugify as slugifyFn } from './slug.util';
import { CompanyAccessService } from './company-access.service';
import { CompanyTemplateService } from './company-template.service';
import { CompanyGroupService } from './company-group.service';
import { CompanyPlatformService } from './company-platform.service';

const DEFAULT_PLATFORM_KEYS = ['yandex', 'twogis'];

@Injectable()
export class CompanyService {
  constructor(
    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,
    @InjectRepository(CompanyDefault)
    private readonly defaultRepo: Repository<CompanyDefault>,
    @InjectRepository(CompanyTemplate)
    private readonly templateRepo: Repository<CompanyTemplate>,
    @InjectRepository(CompanyPlatform)
    private readonly platformRepo: Repository<CompanyPlatform>,
    @InjectRepository(CompanyGroup)
    private readonly groupRepo: Repository<CompanyGroup>,
    @InjectRepository(CompanyGroupMember)
    private readonly groupMemberRepo: Repository<CompanyGroupMember>,
    private readonly dataSource: DataSource,
    private readonly access: CompanyAccessService,
    private readonly templates: CompanyTemplateService,
    private readonly groups: CompanyGroupService,
    private readonly platforms: CompanyPlatformService,
  ) {}

  // ── List ─────────────────────────────────────────────────────────────────

  async list(
    brandId: string,
    userId: string,
    page: number,
    limit: number,
  ): Promise<Paginated<Company>> {
    await this.checkBrandAccess(brandId, userId);

    const [items, total] = await this.companyRepo.findAndCount({
      where: { brandId, status: Not(CompanyStatus.Deleted) },
      order: { createdAt: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { items, total, page, limit };
  }

  // ── Get ──────────────────────────────────────────────────────────────────

  async get(companyId: string, userId: string, brandId: string) {
    const company = await this.getCompanyOrThrow(companyId);
    if (company.brandId !== brandId)
      throw new RpcException({ status: 404, message: 'Company not found' });
    await this.checkBrandAccess(brandId, userId);

    const [def, platforms, groupMembers] = await Promise.all([
      this.defaultRepo.findOne({ where: { companyId: company.id } }),
      this.platformRepo.find({ where: { companyId: company.id } }),
      this.groupMemberRepo.find({ where: { companyId: company.id } }),
    ]);

    const template = def?.templateId
      ? await this.templateRepo.findOne({ where: { id: def.templateId } })
      : null;

    const groups = groupMembers.length
      ? await this.groupRepo.find({
          where: { id: In(groupMembers.map((m) => m.groupId)) },
        })
      : [];

    return {
      ...company,
      groups: groups.map((g) => ({ id: g.id, name: g.name })),
      card: {
        templateId: def?.templateId ?? null,
        fields: this.assembleCardFields(def, template),
      },
      platformsInfo: platforms.map((p) => ({
        platformKey: p.platformKey,
        isEnabled: p.isEnabled,
        status: p.status,
      })),
    };
  }

  // ── Create ───────────────────────────────────────────────────────────────

  async create(dto: {
    brandId: string;
    userId: string;
    name?: string;
    status?: CompanyStatus;
    code?: string;
    twoGisOrgId?: string;
    templateId?: string;
    groups?: { id?: string; name?: string }[];
    fieldOverrides?: FieldOverrides;
  }) {
    await this.checkBrandAccess(dto.brandId, dto.userId);

    // Name: from fieldOverrides.names override, or from template fields, or error
    let resolvedName = dto.name;
    if (!resolvedName) {
      const namesOverride = dto.fieldOverrides?.['names'] as
        | { value: { val: string }[] }
        | undefined;
      resolvedName = namesOverride?.value?.[0]?.val;
    }
    if (!resolvedName && dto.templateId) {
      const template = await this.templateRepo.findOne({
        where: { id: dto.templateId },
      });
      const namesField = template?.fields?.['names'] as
        | { default: { val: string }[] }
        | undefined;
      resolvedName = namesField?.default?.[0]?.val;
    }
    if (!resolvedName) {
      throw new RpcException({
        status: 400,
        message: 'Company name is required',
      });
    }

    const slug = await this.generateSlug(resolvedName);

    return this.dataSource.transaction(async (em) => {
      const company = await em.save(
        em.create(Company, {
          brandId: dto.brandId,
          name: resolvedName,
          slug,
          status: dto.status ?? CompanyStatus.Draft,
          code: dto.code ?? null,
          addressDisplay: null,
          rating: null,
          reviewCount: 0,
        }),
      );

      await em.save(
        em.create(CompanyDefault, {
          companyId: company.id,
          templateId: dto.templateId ?? null,
          fieldOverrides: dto.fieldOverrides ?? {},
        }),
      );

      const now = new Date();
      await em.save(
        DEFAULT_PLATFORM_KEYS.map((platformKey) =>
          em.create(CompanyPlatform, {
            companyId: company.id,
            platformKey,
            status:
              platformKey === 'twogis' && dto.twoGisOrgId
                ? PlatformStatus.Connected
                : PlatformStatus.NotConnected,
            isEnabled: platformKey === 'twogis' && !!dto.twoGisOrgId,
            orgId: platformKey === 'twogis' ? (dto.twoGisOrgId ?? null) : null,
            orgName: null,
            connectedAt:
              platformKey === 'twogis' && dto.twoGisOrgId ? now : null,
            lastSyncAt: null,
            syncError: null,
          }),
        ),
      );

      if (dto.groups?.length) {
        const groupIds: string[] = [];

        for (const g of dto.groups) {
          if (g.id) {
            groupIds.push(g.id);
          } else if (g.name) {
            const newGroup = await em.save(
              em.create(CompanyGroup, { brandId: dto.brandId, name: g.name }),
            );
            groupIds.push(newGroup.id);
          }
        }

        if (groupIds.length) {
          await em.save(
            groupIds.map((groupId) =>
              em.create(CompanyGroupMember, { groupId, companyId: company.id }),
            ),
          );
        }
      }

      return company;
    });
  }

  // ── Delete ───────────────────────────────────────────────────────────────

  async delete(companyId: string, userId: string, brandId: string) {
    const company = await this.getCompanyOrThrow(companyId);
    if (company.brandId !== brandId)
      throw new RpcException({ status: 404, message: 'Company not found' });
    await this.checkBrandAccess(brandId, userId);

    company.status = CompanyStatus.Deleted;
    await this.companyRepo.save(company);
    return null;
  }

  // ── Main data (form endpoint) ─────────────────────────────────────────────

  async getMainData(companyIdOrSlug: string, userId: string, brandId: string) {
    const full = (await this.get(companyIdOrSlug, userId, brandId)) as Record<
      string,
      unknown
    > & {
      card: { templateId: string | null; fields: Record<string, unknown> };
    };
    return {
      id: full['id'],
      name: full['name'],
      groups: full['groups'],
      platformsInfo: full['platformsInfo'],
      templateId: full.card.templateId,
      fields: {
        status: full['status'],
        ...full.card.fields,
      },
    };
  }

  // ── Update default (card data) ────────────────────────────────────────────

  async updateDefault(
    companyId: string,
    userId: string,
    dto: {
      templateId?: string | null;
      fields?: FieldOverrides;
    },
    brandId: string,
  ) {
    const company = await this.getCompanyOrThrow(companyId);
    if (company.brandId !== brandId)
      throw new RpcException({ status: 404, message: 'Company not found' });
    await this.checkBrandAccess(brandId, userId);

    let def = await this.defaultRepo.findOne({ where: { companyId } });

    if (!def) {
      def = this.defaultRepo.create({
        companyId,
        templateId: null,
        fieldOverrides: {},
      });
    }

    if (dto.templateId !== undefined) {
      def.templateId = dto.templateId;
    }

    if (dto.fields) {
      // Merge at field level — untouched fields stay as-is
      def.fieldOverrides = { ...def.fieldOverrides, ...dto.fields };
    }

    await this.defaultRepo.save(def);

    const template = def.templateId
      ? await this.templateRepo.findOne({ where: { id: def.templateId } })
      : null;

    return {
      templateId: def.templateId,
      fields: this.assembleCardFields(def, template),
    };
  }

  // ── Update platform (connection settings) ────────────────────────────────

  updatePlatform(
    companyId: string,
    userId: string,
    platformKey: string,
    dto: {
      isEnabled?: boolean;
      orgId?: string | null;
      orgName?: string | null;
      status?: PlatformStatus;
    },
    brandId: string,
  ) {
    return this.platforms.updatePlatform(
      companyId,
      userId,
      platformKey,
      dto,
      brandId,
    );
  }

  // ── Templates ─────────────────────────────────────────────────────────────

  listTemplates(brandId: string, userId: string) {
    return this.templates.listTemplates(brandId, userId);
  }

  listTemplatesStats(userId: string, brandId: string) {
    return this.templates.listTemplatesStats(userId, brandId);
  }

  getTemplate(templateId: string, userId: string, brandId: string) {
    return this.templates.getTemplate(templateId, userId, brandId);
  }

  createTemplate(dto: {
    brandId: string;
    userId: string;
    name: string;
    fields: Record<string, unknown>;
  }) {
    return this.templates.createTemplate(dto);
  }

  updateTemplate(
    templateId: string,
    userId: string,
    dto: { name?: string; fields?: Record<string, unknown> },
    brandId: string,
  ) {
    return this.templates.updateTemplate(templateId, userId, dto, brandId);
  }

  deleteTemplate(templateId: string, userId: string, brandId: string) {
    return this.templates.deleteTemplate(templateId, userId, brandId);
  }

  // ── Get platforms (full connection data) ─────────────────────────────────

  getPlatforms(companyId: string, userId: string, brandId: string) {
    return this.platforms.getPlatforms(companyId, userId, brandId);
  }

  // ── Groups ───────────────────────────────────────────────────────────────

  listGroups(brandId: string, userId: string, search?: string) {
    return this.groups.listGroups(brandId, userId, search);
  }

  listGroupsStats(userId: string, brandId: string, search?: string) {
    return this.groups.listGroupsStats(userId, brandId, search);
  }

  removeCompaniesFromGroup(
    groupId: string,
    userId: string,
    companyIds: string[],
    brandId: string,
  ) {
    return this.groups.removeCompaniesFromGroup(
      groupId,
      userId,
      companyIds,
      brandId,
    );
  }

  addCompaniesToGroup(
    groupId: string,
    userId: string,
    companyIds: string[],
    brandId: string,
  ) {
    return this.groups.addCompaniesToGroup(
      groupId,
      userId,
      companyIds,
      brandId,
    );
  }

  getGroup(groupId: string, userId: string, brandId: string) {
    return this.groups.getGroup(groupId, userId, brandId);
  }

  createGroup(dto: { brandId: string; userId: string; name: string }) {
    return this.groups.createGroup(dto);
  }

  updateGroup(groupId: string, userId: string, name: string, brandId: string) {
    return this.groups.updateGroup(groupId, userId, name, brandId);
  }

  deleteGroup(groupId: string, userId: string, brandId: string) {
    return this.groups.deleteGroup(groupId, userId, brandId);
  }

  updateCompanyGroups(
    companyId: string,
    userId: string,
    groupIds: string[],
    brandId: string,
  ) {
    return this.groups.updateCompanyGroups(
      companyId,
      userId,
      groupIds,
      brandId,
    );
  }

  // ── findByTwoGisOrgId (used by integration service) ──────────────────────

  findByTwoGisOrgId(
    orgId: string,
  ): Promise<{ id: string; brandId: string } | null> {
    return this.platforms.findByTwoGisOrgId(orgId);
  }

  // ── Resolve (for sync services) ───────────────────────────────────────────

  // Returns the final flat field values for a given platform.
  // Priority: platform override → company value → template value.
  resolveForPlatform(
    platformKey: string,
    templateFields: Record<string, unknown>,
    overrides: FieldOverrides,
  ): Record<string, unknown> {
    return resolveForPlatformFn(platformKey, templateFields, overrides);
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  // Builds the per-field response (см. card-fields.ts).
  private assembleCardFields(
    def: CompanyDefault | null,
    template: CompanyTemplate | null,
  ): Record<string, unknown> {
    return assembleCardFieldsFn(def, template);
  }

  private getCompanyOrThrow(idOrSlug: string): Promise<Company> {
    return this.access.getCompanyOrThrow(idOrSlug);
  }

  private checkBrandAccess(brandId: string, userId: string): Promise<void> {
    return this.access.assertBrandAccess(brandId, userId);
  }

  private async generateSlug(name: string): Promise<string> {
    const base = this.slugify(name).slice(0, 250);

    for (let i = 0; i < 10; i++) {
      const slug = i === 0 ? base : `${base}-${i}`;
      if (!(await this.companyRepo.findOne({ where: { slug } }))) return slug;
    }

    return `${base}-${Date.now().toString(36)}`;
  }

  private slugify(text: string): string {
    return slugifyFn(text);
  }
}

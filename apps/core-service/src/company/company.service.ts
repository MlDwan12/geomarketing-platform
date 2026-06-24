import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, ILike, In, Not, Repository } from 'typeorm';
import { RpcException } from '@nestjs/microservices';
import { Paginated } from '@geo/contracts';
import { Company, CompanyStatus } from './company.entity';
import { CompanyDefault, FieldOverride, FieldOverrides } from './company-default.entity';
import { CompanyTemplate } from './company-template.entity';
import { CompanyPlatform, PlatformStatus } from './company-platform.entity';
import { CompanyGroup } from './company-group.entity';
import { CompanyGroupMember } from './company-group-member.entity';
import { UserBrand } from '../brand/user-brand.entity';

const DEFAULT_PLATFORM_KEYS = ['yandex', 'twogis'];

const LANG_MERGE_FIELDS = new Set([
  'names', 'shortNames', 'altNames', 'descriptions', 'shortDescriptions',
]);

type LangItem = { lang: string; val: string };

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
    @InjectRepository(UserBrand)
    private readonly userBrandRepo: Repository<UserBrand>,
    private readonly dataSource: DataSource,
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

  async get(companyId: string, userId: string) {
    const company = await this.getCompanyOrThrow(companyId);
    await this.checkBrandAccess(company.brandId, userId);

    const [def, platforms, groupMembers] = await Promise.all([
      this.defaultRepo.findOne({ where: { companyId } }),
      this.platformRepo.find({ where: { companyId } }),
      this.groupMemberRepo.find({ where: { companyId } }),
    ]);

    const template = def?.templateId
      ? await this.templateRepo.findOne({ where: { id: def.templateId } })
      : null;

    const groups = groupMembers.length
      ? await this.groupRepo.find({ where: { id: In(groupMembers.map((m) => m.groupId)) } })
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
    name: string;
    status?: CompanyStatus;
    code?: string;
    twoGisOrgId?: string;
    templateId?: string;
    groups?: { id?: string; name?: string }[];
    fieldOverrides?: FieldOverrides;
  }) {
    await this.checkBrandAccess(dto.brandId, dto.userId);

    const slug = await this.generateSlug(dto.name);

    return this.dataSource.transaction(async (em) => {
      const company = await em.save(
        em.create(Company, {
          brandId: dto.brandId,
          name: dto.name,
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
            connectedAt: platformKey === 'twogis' && dto.twoGisOrgId ? now : null,
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

  async delete(companyId: string, userId: string) {
    const company = await this.getCompanyOrThrow(companyId);
    await this.checkBrandAccess(company.brandId, userId);

    company.status = CompanyStatus.Deleted;
    await this.companyRepo.save(company);
  }

  // ── Update default (card data) ────────────────────────────────────────────

  async updateDefault(
    companyId: string,
    userId: string,
    dto: {
      templateId?: string | null;
      fields?: FieldOverrides;
    },
  ) {
    const company = await this.getCompanyOrThrow(companyId);
    await this.checkBrandAccess(company.brandId, userId);

    let def = await this.defaultRepo.findOne({ where: { companyId } });

    if (!def) {
      def = this.defaultRepo.create({ companyId, templateId: null, fieldOverrides: {} });
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

  async updatePlatform(
    companyId: string,
    userId: string,
    platformKey: string,
    dto: {
      isEnabled?: boolean;
      orgId?: string | null;
      orgName?: string | null;
      status?: PlatformStatus;
    },
  ) {
    const company = await this.getCompanyOrThrow(companyId);
    await this.checkBrandAccess(company.brandId, userId);

    let platform = await this.platformRepo.findOne({ where: { companyId, platformKey } });

    if (!platform) {
      platform = this.platformRepo.create({
        companyId,
        platformKey,
        status: PlatformStatus.NotConnected,
        isEnabled: false,
        orgId: null,
        orgName: null,
        connectedAt: null,
        lastSyncAt: null,
        syncError: null,
      });
    }

    Object.assign(platform, dto);

    if (dto.orgId && !platform.connectedAt) {
      platform.connectedAt = new Date();
      platform.status = PlatformStatus.Connected;
    }

    return this.platformRepo.save(platform);
  }

  // ── Templates ─────────────────────────────────────────────────────────────

  async listTemplates(brandId: string, userId: string) {
    await this.checkBrandAccess(brandId, userId);
    return this.templateRepo.find({ where: { brandId }, order: { createdAt: 'ASC' } });
  }

  async createTemplate(dto: {
    brandId: string;
    userId: string;
    name: string;
    fields: Record<string, unknown>;
  }) {
    await this.checkBrandAccess(dto.brandId, dto.userId);
    return this.templateRepo.save(
      this.templateRepo.create({
        brandId: dto.brandId,
        name: dto.name,
        fields: dto.fields,
      }),
    );
  }

  async updateTemplate(
    templateId: string,
    userId: string,
    dto: { name?: string; fields?: Record<string, unknown> },
  ) {
    const template = await this.templateRepo.findOne({ where: { id: templateId } });

    if (!template) {
      throw new RpcException({ status: 404, message: 'Template not found' });
    }

    await this.checkBrandAccess(template.brandId, userId);
    Object.assign(template, dto);
    return this.templateRepo.save(template);
  }

  async deleteTemplate(templateId: string, userId: string) {
    const template = await this.templateRepo.findOne({ where: { id: templateId } });

    if (!template) {
      throw new RpcException({ status: 404, message: 'Template not found' });
    }

    await this.checkBrandAccess(template.brandId, userId);

    // Detach companies before deleting so they don't lose their data
    await this.defaultRepo.update({ templateId }, { templateId: null });
    await this.templateRepo.remove(template);
  }

  // ── Get platforms (full connection data) ─────────────────────────────────

  async getPlatforms(companyId: string, userId: string) {
    const company = await this.getCompanyOrThrow(companyId);
    await this.checkBrandAccess(company.brandId, userId);
    return this.platformRepo.find({ where: { companyId } });
  }

  // ── Groups ───────────────────────────────────────────────────────────────

  async listGroups(brandId: string, userId: string, search?: string) {
    await this.checkBrandAccess(brandId, userId);
    const groups = await this.groupRepo.find({
      where: { brandId, ...(search ? { name: ILike(`%${search}%`) } : {}) },
      order: { createdAt: 'ASC' },
    });
    return groups.map((g) => ({ id: g.id, name: g.name }));
  }

  async listGroupsStats(userId: string, search?: string) {
    const userBrands = await this.userBrandRepo.find({ where: { userId } });
    if (!userBrands.length) return [];

    const brandIds = userBrands.map((b) => b.brandId);
    const params: unknown[] = [brandIds];
    let searchClause = '';

    if (search) {
      params.push(`%${search}%`);
      searchClause = `AND g.name ILIKE $${params.length}`;
    }

    const rows: { id: string; name: string; brandId: string; companiesCount: string }[] =
      await this.dataSource.query(
        `SELECT g.id, g.name, g."brandId", COUNT(m."companyId")::int AS "companiesCount"
         FROM company_groups g
         LEFT JOIN company_group_members m ON m."groupId" = g.id
         WHERE g."brandId" = ANY($1) ${searchClause}
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

  async addCompaniesToGroup(groupId: string, userId: string, companyIds: string[]) {
    const group = await this.getGroupOrThrow(groupId);
    await this.checkBrandAccess(group.brandId, userId);

    if (!companyIds.length) return { groupId, added: 0 };

    const valid = await this.companyRepo.find({
      where: { id: In(companyIds), brandId: group.brandId },
    });
    if (valid.length !== companyIds.length) {
      throw new RpcException({ status: 400, message: 'One or more company IDs are invalid' });
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

  async getGroup(groupId: string, userId: string) {
    const group = await this.getGroupOrThrow(groupId);
    await this.checkBrandAccess(group.brandId, userId);

    const members = await this.groupMemberRepo.find({ where: { groupId } });
    const companies = members.length
      ? await this.companyRepo.find({ where: { id: In(members.map((m) => m.companyId)) } })
      : [];

    return {
      id: group.id,
      name: group.name,
      companiesCount: companies.length,
      companies: companies.map((c) => ({ id: c.id, name: c.name })),
    };
  }

  async createGroup(dto: { brandId: string; userId: string; name: string }) {
    await this.checkBrandAccess(dto.brandId, dto.userId);
    return this.groupRepo.save(
      this.groupRepo.create({ brandId: dto.brandId, name: dto.name }),
    );
  }

  async updateGroup(groupId: string, userId: string, name: string) {
    const group = await this.getGroupOrThrow(groupId);
    await this.checkBrandAccess(group.brandId, userId);
    group.name = name;
    return this.groupRepo.save(group);
  }

  async deleteGroup(groupId: string, userId: string) {
    const group = await this.getGroupOrThrow(groupId);
    await this.checkBrandAccess(group.brandId, userId);
    await this.groupRepo.remove(group);
  }

  async updateCompanyGroups(companyId: string, userId: string, groupIds: string[]) {
    const company = await this.getCompanyOrThrow(companyId);
    await this.checkBrandAccess(company.brandId, userId);

    if (groupIds.length) {
      const validGroups = await this.groupRepo.find({
        where: { id: In(groupIds), brandId: company.brandId },
      });
      if (validGroups.length !== groupIds.length) {
        throw new RpcException({ status: 400, message: 'One or more group IDs are invalid' });
      }
    }

    return this.dataSource.transaction(async (em) => {
      await em.delete(CompanyGroupMember, { companyId });
      if (groupIds.length) {
        await em.save(
          groupIds.map((groupId) => em.create(CompanyGroupMember, { groupId, companyId })),
        );
      }
      return { companyId, groupIds };
    });
  }

  // ── findByTwoGisOrgId (used by integration service) ──────────────────────

  async findByTwoGisOrgId(orgId: string): Promise<{ id: string; brandId: string } | null> {
    const platform = await this.platformRepo.findOne({
      where: { platformKey: 'twogis', orgId },
    });
    if (!platform) return null;

    const company = await this.companyRepo.findOne({ where: { id: platform.companyId } });
    if (!company) return null;

    return { id: company.id, brandId: company.brandId };
  }

  // ── Resolve (for sync services) ───────────────────────────────────────────

  // Returns the final flat field values for a given platform.
  // Priority: platform override → company value → template value.
  resolveForPlatform(
    platformKey: string,
    templateFields: Record<string, unknown>,
    overrides: FieldOverrides,
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    const allKeys = new Set([...Object.keys(templateFields), ...Object.keys(overrides)]);

    for (const key of allKeys) {
      const override = overrides[key] as FieldOverride | undefined;
      const templateValue = templateFields[key];

      // Base value priority: company value (no template) → exception override → template
      let baseValue: unknown;
      if (override?.value !== undefined && override?.isException !== false) {
        baseValue = override.value;
      } else if (templateValue !== undefined) {
        baseValue = templateValue;
      }

      const platformOverride = override?.platforms?.[platformKey];

      if (platformOverride !== undefined) {
        // Multilingual fields: merge by lang key, not full replacement
        if (LANG_MERGE_FIELDS.has(key) && Array.isArray(baseValue) && Array.isArray(platformOverride)) {
          result[key] = this.mergeLangArrays(baseValue as LangItem[], platformOverride as LangItem[]);
        } else {
          result[key] = platformOverride;
        }
      } else if (baseValue !== undefined) {
        result[key] = baseValue;
      }
    }

    return result;
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  // Builds the per-field response.
  // No template:   { value, platforms }
  // With template: { isException, default, platforms }
  private assembleCardFields(
    def: CompanyDefault | null,
    template: CompanyTemplate | null,
  ): Record<string, unknown> {
    const overrides = (def?.fieldOverrides ?? {}) as FieldOverrides;
    const templateFields = (template?.fields ?? {}) as Record<string, unknown>;
    const allKeys = new Set([...Object.keys(templateFields), ...Object.keys(overrides)]);
    const result: Record<string, unknown> = {};

    for (const key of allKeys) {
      const override = overrides[key] as FieldOverride | undefined;
      const field: Record<string, unknown> = {};

      if (template === null) {
        if (override?.value !== undefined) field['value'] = override.value;
        field['platforms'] = override?.platforms ?? {};
      } else {
        const templateValue = templateFields[key];
        if (override?.isException) {
          field['isException'] = true;
          if (override.value !== undefined) field['default'] = override.value;
        } else {
          field['isException'] = false;
          if (templateValue !== undefined) field['default'] = templateValue;
        }
        field['platforms'] = override?.platforms ?? {};
      }

      result[key] = field;
    }

    return result;
  }

  private mergeLangArrays(base: LangItem[], override: LangItem[]): LangItem[] {
    const result = [...base];
    for (const item of override) {
      const idx = result.findIndex((i) => i.lang === item.lang);
      if (idx >= 0) result[idx] = item;
      else result.push(item);
    }
    return result;
  }

  private async getCompanyOrThrow(idOrSlug: string): Promise<Company> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);
    const company = await this.companyRepo.findOne({
      where: isUuid ? { id: idOrSlug } : { slug: idOrSlug },
    });

    if (!company || company.status === CompanyStatus.Deleted) {
      throw new RpcException({ status: 404, message: 'Company not found' });
    }

    return company;
  }

  private async getGroupOrThrow(groupId: string): Promise<CompanyGroup> {
    const group = await this.groupRepo.findOne({ where: { id: groupId } });
    if (!group) throw new RpcException({ status: 404, message: 'Group not found' });
    return group;
  }

  private async checkBrandAccess(brandId: string, userId: string): Promise<void> {
    const membership = await this.userBrandRepo.findOne({ where: { brandId, userId } });

    if (!membership) {
      throw new RpcException({ status: 403, message: 'Forbidden' });
    }
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
    const map: Record<string, string> = {
      а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'zh',
      з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o',
      п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts',
      ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu',
      я: 'ya',
    };
    return text
      .toLowerCase()
      .split('')
      .map((c) => map[c] ?? c)
      .join('')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}

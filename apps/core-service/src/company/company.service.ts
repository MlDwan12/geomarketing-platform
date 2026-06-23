import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Not, Repository } from 'typeorm';
import { RpcException } from '@nestjs/microservices';
import { Paginated } from '@geo/contracts';
import { Company, CompanyStatus } from './company.entity';
import { CompanyDefault, FieldOverride, FieldOverrides } from './company-default.entity';
import { CompanyTemplate } from './company-template.entity';
import { CompanyPlatform, PlatformStatus } from './company-platform.entity';
import { UserBrand } from '../brand/user-brand.entity';

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

    const def = await this.defaultRepo.findOne({ where: { companyId } });
    const template = def?.templateId
      ? await this.templateRepo.findOne({ where: { id: def.templateId } })
      : null;
    const platforms = await this.platformRepo.find({ where: { companyId } });

    return {
      ...company,
      card: {
        templateId: def?.templateId ?? null,
        fields: this.assembleCardFields(def, template),
      },
      platforms: platforms.map((p) => ({
        platformKey: p.platformKey,
        isEnabled: p.isEnabled,
        status: p.status,
        orgId: p.orgId,
        orgName: p.orgName,
        connectedAt: p.connectedAt,
        lastSyncAt: p.lastSyncAt,
        syncError: p.syncError,
      })),
    };
  }

  // ── Create ───────────────────────────────────────────────────────────────

  async create(dto: {
    brandId: string;
    userId: string;
    name: string;
    code?: string;
    twoGisOrgId?: string;
    addressDisplay?: string;
    rating?: number | null;
    reviewCount?: number;
    templateId?: string;
  }) {
    await this.checkBrandAccess(dto.brandId, dto.userId);

    const slug = await this.generateSlug(dto.name);

    return this.dataSource.transaction(async (em) => {
      const company = await em.save(
        em.create(Company, {
          brandId: dto.brandId,
          name: dto.name,
          slug,
          status: CompanyStatus.Draft,
          code: dto.code ?? null,
          addressDisplay: dto.addressDisplay ?? null,
          rating: dto.rating ?? null,
          reviewCount: dto.reviewCount ?? 0,
        }),
      );

      await em.save(
        em.create(CompanyDefault, {
          companyId: company.id,
          templateId: dto.templateId ?? null,
          fieldOverrides: {},
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
      fieldOverrides?: FieldOverrides;
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

    if (dto.fieldOverrides) {
      // Merge at field level — untouched fields stay as-is
      def.fieldOverrides = { ...def.fieldOverrides, ...dto.fieldOverrides };
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

      if (override?.platforms?.[platformKey] !== undefined) {
        result[key] = override.platforms[platformKey];
      } else if (override?.isException && override.value !== undefined) {
        result[key] = override.value;
      } else if (templateValue !== undefined) {
        result[key] = templateValue;
      }
    }

    return result;
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  // Builds the per-field response: { fieldName: { isException, default, platforms? } }
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
      const templateValue = templateFields[key];
      const field: Record<string, unknown> = {};

      if (override?.isException) {
        field['isException'] = true;
        if (override.value !== undefined) field['default'] = override.value;
      } else {
        field['isException'] = false;
        if (templateValue !== undefined) field['default'] = templateValue;
      }

      if (override?.platforms && Object.keys(override.platforms).length > 0) {
        field['platforms'] = override.platforms;
      }

      result[key] = field;
    }

    return result;
  }

  private async getCompanyOrThrow(companyId: string): Promise<Company> {
    const company = await this.companyRepo.findOne({ where: { id: companyId } });

    if (!company || company.status === CompanyStatus.Deleted) {
      throw new RpcException({ status: 404, message: 'Company not found' });
    }

    return company;
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

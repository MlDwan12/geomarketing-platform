import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Not, Repository } from 'typeorm';
import { RpcException } from '@nestjs/microservices';
import { Paginated } from '@geo/contracts';
import { Company, CompanyStatus } from './company.entity';
import { CompanyCard } from './company-card.entity';
import { CompanyPlatform, PlatformStatus, PlatformType } from './company-platform.entity';
import { UserBrand } from '../brand/user-brand.entity';

@Injectable()
export class CompanyService {
  constructor(
    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,
    @InjectRepository(CompanyCard)
    private readonly cardRepo: Repository<CompanyCard>,
    @InjectRepository(CompanyPlatform)
    private readonly platformRepo: Repository<CompanyPlatform>,
    @InjectRepository(UserBrand)
    private readonly userBrandRepo: Repository<UserBrand>,
    private readonly dataSource: DataSource,
  ) {}

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

  async create(dto: {
    brandId: string;
    userId: string;
    name: string;
    code?: string;
    twoGisOrgId?: string;
    addressDisplay?: string;
    rating?: number | null;
    reviewCount?: number;
    card?: Record<string, unknown>;
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

      await em.save(em.create(CompanyCard, { companyId: company.id, ...(dto.card ?? {}) }));

      const now = new Date();

      await em.save([
        em.create(CompanyPlatform, {
          companyId: company.id,
          platform: PlatformType.Yandex,
          status: PlatformStatus.NotConnected,
          isEnabled: false,
          orgId: null,
          orgName: null,
          connectedAt: null,
          lastSyncAt: null,
          syncError: null,
        }),
        em.create(CompanyPlatform, {
          companyId: company.id,
          platform: PlatformType.TwoGis,
          status: dto.twoGisOrgId ? PlatformStatus.Connected : PlatformStatus.NotConnected,
          isEnabled: dto.twoGisOrgId ? true : false,
          orgId: dto.twoGisOrgId ?? null,
          orgName: null,
          connectedAt: dto.twoGisOrgId ? now : null,
          lastSyncAt: null,
          syncError: null,
        }),
      ]);

      return company;
    });
  }

  async get(companyId: string, userId: string) {
    const company = await this.getCompanyOrThrow(companyId);
    await this.checkBrandAccess(company.brandId, userId);

    const card = await this.cardRepo.findOne({ where: { companyId } });
    const platforms = await this.platformRepo.find({ where: { companyId } });

    return { ...company, card: card ?? null, platforms };
  }

  async findByTwoGisOrgId(orgId: string): Promise<{ id: string; brandId: string } | null> {
    const platform = await this.platformRepo.findOne({
      where: { platform: PlatformType.TwoGis, orgId },
    });
    if (!platform) return null;

    const company = await this.companyRepo.findOne({ where: { id: platform.companyId } });
    if (!company) return null;

    return { id: company.id, brandId: company.brandId };
  }

  async getCard(companyId: string, userId: string) {
    const company = await this.getCompanyOrThrow(companyId);
    await this.checkBrandAccess(company.brandId, userId);

    const card = await this.cardRepo.findOne({ where: { companyId } });

    if (!card) {
      throw new RpcException({ status: 404, message: 'Company card not found' });
    }

    return card;
  }

  async updateCard(
    companyId: string,
    userId: string,
    fields: Partial<Omit<CompanyCard, 'companyId' | 'updatedAt'>>,
  ) {
    const company = await this.getCompanyOrThrow(companyId);
    await this.checkBrandAccess(company.brandId, userId);

    await this.cardRepo.update({ companyId }, fields as any);

    const nameDefault = this.extractDefaultName(fields.names);
    const addressDisplay = this.extractAddressDisplay(fields.address);

    const companyUpdate: Partial<Company> = {};
    if (nameDefault) companyUpdate.name = nameDefault;
    if (addressDisplay) companyUpdate.addressDisplay = addressDisplay;

    if (Object.keys(companyUpdate).length) {
      await this.companyRepo.update({ id: companyId }, companyUpdate);
    }

    return this.cardRepo.findOne({ where: { companyId } });
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

  private extractDefaultName(names: unknown): string | null {
    if (!Array.isArray(names)) return null;
    const ru = (names as { lang: string; val: string }[]).find((n) => n.lang === 'ru');
    return ru?.val?.trim() || null;
  }

  private extractAddressDisplay(address: unknown): string | null {
    if (!address || typeof address !== 'object') return null;
    const a = address as Record<string, string>;
    const parts = [a.city, a.street, a.building].filter(Boolean);
    return parts.length ? parts.join(', ') : null;
  }
}

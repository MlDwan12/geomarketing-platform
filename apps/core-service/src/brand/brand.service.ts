import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RpcException } from '@nestjs/microservices';
import { Brand, BrandStatus } from './brand.entity';
import { BrandRole, UserBrand } from './user-brand.entity';
import { UserStatus } from '../user/user.entity';
import { isUniqueViolation } from '../common/unique-violation.util';
import { hasMinRole } from '../common/brand-role.util';

// DB-002: тот же паттерн гонки, что и в CompanyService.generateSlug —
// см. комментарий там.
const MAX_SLUG_RETRIES = 3;

@Injectable()
export class BrandService {
  constructor(
    @InjectRepository(Brand)
    private readonly brandRepo: Repository<Brand>,
    @InjectRepository(UserBrand)
    private readonly userBrandRepo: Repository<UserBrand>,
  ) {}

  async list(userId: string) {
    return this.brandRepo
      .createQueryBuilder('b')
      .innerJoin('user_brands', 'ub', 'ub."brandId" = b.id AND ub."userId" = :userId', { userId })
      .where('b.status != :deleted', { deleted: BrandStatus.Deleted })
      .orderBy('b."createdAt"', 'ASC')
      .getMany();
  }

  async listShort(userId: string) {
    return this.brandRepo
      .createQueryBuilder('b')
      .select(['b.id', 'b.name', 'b.logoUrl', 'b.slug'])
      .innerJoin('user_brands', 'ub', 'ub."brandId" = b.id AND ub."userId" = :userId', { userId })
      .where('b.status != :deleted', { deleted: BrandStatus.Deleted })
      .orderBy('b."createdAt"', 'ASC')
      .getMany();
  }

  async get(brandId: string, userId: string) {
    const brand = await this.brandRepo.findOne({ where: { id: brandId } });

    if (!brand || brand.status === BrandStatus.Deleted) {
      throw new RpcException({ status: 404, message: 'Brand not found' });
    }

    await this.assertBrandAccess(brandId, userId);

    return brand;
  }

  async create(dto: {
    name: string;
    timezone: string;
    description?: string;
    logoUrl?: string;
    userId: string;
    status?: BrandStatus;
  }) {
    let brand: Brand | undefined;
    for (let attempt = 0; ; attempt++) {
      const slug = await this.generateSlug(dto.name);
      try {
        brand = await this.brandRepo.save(
          this.brandRepo.create({
            name: dto.name,
            slug,
            ownerId: dto.userId,
            timezone: dto.timezone,
            description: dto.description ?? null,
            logoUrl: dto.logoUrl ?? null,
            status: dto.status ?? BrandStatus.Active,
          }),
        );
        break;
      } catch (err) {
        if (
          attempt < MAX_SLUG_RETRIES &&
          isUniqueViolation(err, 'UQ_brands_slug')
        )
          continue;
        throw err;
      }
    }

    await this.userBrandRepo.save(
      this.userBrandRepo.create({
        userId: dto.userId,
        brandId: brand.id,
        role: BrandRole.Owner,
        status: UserStatus.Active,
        lastLoginAt: null,
      }),
    );

    return brand;
  }

  async delete(brandId: string, userId: string) {
    const brand = await this.brandRepo.findOne({ where: { id: brandId } });

    if (!brand || brand.status === BrandStatus.Deleted) {
      throw new RpcException({ status: 404, message: 'Brand not found' });
    }

    await this.assertBrandAccess(brandId, userId, BrandRole.Owner);

    brand.status = BrandStatus.Deleted;
    await this.brandRepo.save(brand);
  }

  async update(
    brandId: string,
    dto: {
      name?: string;
      timezone?: string;
      description?: string;
      logoUrl?: string;
      userId: string;
    },
  ) {
    const brand = await this.brandRepo.findOne({ where: { id: brandId } });

    if (!brand || brand.status === BrandStatus.Deleted) {
      throw new RpcException({ status: 404, message: 'Brand not found' });
    }

    await this.assertBrandAccess(brandId, dto.userId, BrandRole.Owner);

    const { userId: _, ...fields } = dto;

    if (!fields.name || fields.name === brand.name) {
      Object.assign(brand, fields);
      return this.brandRepo.save(brand);
    }

    for (let attempt = 0; ; attempt++) {
      const newSlug = await this.generateSlug(fields.name);
      Object.assign(brand, fields, { slug: newSlug });
      try {
        return await this.brandRepo.save(brand);
      } catch (err) {
        if (
          attempt < MAX_SLUG_RETRIES &&
          isUniqueViolation(err, 'UQ_brands_slug')
        )
          continue;
        throw err;
      }
    }
  }

  // Та же логика, что CompanyAccessService.assertBrandAccess в company-модуле —
  // не переиспользуем напрямую, чтобы не тянуть межмодульную зависимость
  // BrandModule -> CompanyModule ради одной проверки (см. docs/refactor-plans/
  // team-brand-roles.md, коммит 9).
  private async assertBrandAccess(
    brandId: string,
    userId: string,
    minRole: BrandRole = BrandRole.Viewer,
  ): Promise<UserBrand> {
    const membership = await this.userBrandRepo.findOne({
      where: { brandId, userId },
    });

    if (!membership || !hasMinRole(membership.role, minRole)) {
      throw new RpcException({ status: 403, message: 'Forbidden' });
    }

    return membership;
  }

  private async generateSlug(name: string): Promise<string> {
    const base = this.slugify(name).slice(0, 80);

    for (let i = 0; i < 10; i++) {
      const slug = i === 0 ? base : `${base}-${i}`;
      if (!(await this.brandRepo.findOne({ where: { slug } }))) return slug;
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

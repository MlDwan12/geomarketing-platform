import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RpcException } from '@nestjs/microservices';
import { Brand, BrandStatus } from './brand.entity';
import { UserBrand } from './user-brand.entity';
import { UserRole, UserStatus } from '../user/user.entity';

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

    const hasAccess =
      brand.ownerId === userId ||
      !!(await this.userBrandRepo.findOne({ where: { brandId, userId } }));

    if (!hasAccess) {
      throw new RpcException({ status: 403, message: 'Forbidden' });
    }

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
    const slug = await this.generateSlug(dto.name);

    const brand = await this.brandRepo.save(
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

    await this.userBrandRepo.save(
      this.userBrandRepo.create({
        userId: dto.userId,
        brandId: brand.id,
        role: UserRole.Owner,
        status: UserStatus.Active,
        lastLoginAt: null,
      }),
    );

    return brand;
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

    if (brand.ownerId !== dto.userId) {
      throw new RpcException({ status: 403, message: 'Only owner can update brand' });
    }

    const { userId: _, ...fields } = dto;

    if (fields.name && fields.name !== brand.name) {
      const newSlug = await this.generateSlug(fields.name);
      Object.assign(brand, fields, { slug: newSlug });
    } else {
      Object.assign(brand, fields);
    }

    return this.brandRepo.save(brand);
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

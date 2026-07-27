import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RpcException } from '@nestjs/microservices';
import { Company, CompanyStatus } from './company.entity';
import { UserBrand } from '../brand/user-brand.entity';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Общие проверки доступа и поиск компании — используются CompanyService и под-сервисами.
@Injectable()
export class CompanyAccessService {
  constructor(
    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,
    @InjectRepository(UserBrand)
    private readonly userBrandRepo: Repository<UserBrand>,
  ) {}

  async assertBrandAccess(brandId: string, userId: string): Promise<void> {
    const membership = await this.userBrandRepo.findOne({
      where: { brandId, userId },
    });

    if (!membership) {
      throw new RpcException({ status: 403, message: 'Forbidden' });
    }
  }

  async getCompanyOrThrow(idOrSlug: string): Promise<Company> {
    const isUuid = UUID_RE.test(idOrSlug);
    const company = await this.companyRepo.findOne({
      where: isUuid ? { id: idOrSlug } : { slug: idOrSlug },
    });

    if (!company || company.status === CompanyStatus.Deleted) {
      throw new RpcException({ status: 404, message: 'Company not found' });
    }

    return company;
  }
}

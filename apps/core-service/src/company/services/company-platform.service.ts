import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RpcException } from '@nestjs/microservices';
import { Company } from '../entities/company.entity';
import {
  CompanyPlatform,
  PlatformStatus,
} from '../entities/company-platform.entity';
import { CompanyAccessService } from './company-access.service';
import { BrandRole } from '../../brand/user-brand.entity';

@Injectable()
export class CompanyPlatformService {
  constructor(
    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,
    @InjectRepository(CompanyPlatform)
    private readonly platformRepo: Repository<CompanyPlatform>,
    private readonly access: CompanyAccessService,
  ) {}

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
    brandId: string,
  ) {
    const company = await this.access.getCompanyOrThrow(companyId);
    if (company.brandId !== brandId)
      throw new RpcException({ status: 404, message: 'Company not found' });
    await this.access.assertBrandAccess(brandId, userId, BrandRole.Manager);

    let platform = await this.platformRepo.findOne({
      where: { companyId, platformKey },
    });

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

    if (dto.isEnabled !== undefined) platform.isEnabled = dto.isEnabled;
    if (dto.orgId !== undefined) platform.orgId = dto.orgId;
    if (dto.orgName !== undefined) platform.orgName = dto.orgName;
    if (dto.status !== undefined) platform.status = dto.status;

    if (dto.orgId && !platform.connectedAt) {
      platform.connectedAt = new Date();
      platform.status = PlatformStatus.Connected;
    }

    return this.platformRepo.save(platform);
  }

  async getPlatforms(companyId: string, userId: string, brandId: string) {
    const company = await this.access.getCompanyOrThrow(companyId);
    if (company.brandId !== brandId)
      throw new RpcException({ status: 404, message: 'Company not found' });
    await this.access.assertBrandAccess(brandId, userId);
    return this.platformRepo.find({ where: { companyId } });
  }

  async findByTwoGisOrgId(
    orgId: string,
  ): Promise<{ id: string; brandId: string } | null> {
    const platform = await this.platformRepo.findOne({
      where: { platformKey: 'twogis', orgId },
    });
    if (!platform) return null;

    const company = await this.companyRepo.findOne({
      where: { id: platform.companyId },
    });
    if (!company) return null;

    return { id: company.id, brandId: company.brandId };
  }
}

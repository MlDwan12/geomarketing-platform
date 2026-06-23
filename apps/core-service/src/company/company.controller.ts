import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { Patterns } from '@geo/contracts';
import { CompanyService } from './company.service';
import { FieldOverrides } from './company-default.entity';
import { PlatformStatus } from './company-platform.entity';

@Controller()
export class CompanyController {
  constructor(private readonly companyService: CompanyService) {}

  @MessagePattern(Patterns.COMPANY_LIST)
  list(
    @Payload()
    { brandId, userId, page, limit }: { brandId: string; userId: string; page: number; limit: number },
  ) {
    return this.companyService.list(brandId, userId, page, limit);
  }

  @MessagePattern(Patterns.COMPANY_GET)
  get(@Payload() { companyId, userId }: { companyId: string; userId: string }) {
    return this.companyService.get(companyId, userId);
  }

  @MessagePattern(Patterns.COMPANY_CREATE)
  create(
    @Payload()
    dto: {
      brandId: string;
      userId: string;
      name: string;
      code?: string;
      twoGisOrgId?: string;
      addressDisplay?: string;
      templateId?: string;
    },
  ) {
    return this.companyService.create(dto);
  }

  @MessagePattern(Patterns.COMPANY_FIND_BY_TWOGIS_ORG_ID)
  findByTwoGisOrgId(@Payload() { orgId }: { orgId: string }) {
    return this.companyService.findByTwoGisOrgId(orgId);
  }

  @MessagePattern(Patterns.COMPANY_DELETE)
  delete(@Payload() { companyId, userId }: { companyId: string; userId: string }) {
    return this.companyService.delete(companyId, userId);
  }

  @MessagePattern(Patterns.COMPANY_PLATFORMS_GET)
  getPlatforms(@Payload() { companyId, userId }: { companyId: string; userId: string }) {
    return this.companyService.getPlatforms(companyId, userId);
  }

  @MessagePattern(Patterns.COMPANY_DEFAULT_UPDATE)
  updateDefault(
    @Payload()
    dto: {
      companyId: string;
      userId: string;
      templateId?: string | null;
      fieldOverrides?: FieldOverrides;
    },
  ) {
    const { companyId, userId, ...rest } = dto;
    return this.companyService.updateDefault(companyId, userId, rest);
  }

  @MessagePattern(Patterns.COMPANY_PLATFORM_UPDATE)
  updatePlatform(
    @Payload()
    dto: {
      companyId: string;
      userId: string;
      platformKey: string;
      isEnabled?: boolean;
      orgId?: string | null;
      orgName?: string | null;
      status?: PlatformStatus;
    },
  ) {
    const { companyId, userId, platformKey, ...rest } = dto;
    return this.companyService.updatePlatform(companyId, userId, platformKey, rest);
  }

  // ── Templates ─────────────────────────────────────────────────────────────

  @MessagePattern(Patterns.TEMPLATE_LIST)
  listTemplates(@Payload() { brandId, userId }: { brandId: string; userId: string }) {
    return this.companyService.listTemplates(brandId, userId);
  }

  @MessagePattern(Patterns.TEMPLATE_CREATE)
  createTemplate(
    @Payload()
    dto: { brandId: string; userId: string; name: string; fields: Record<string, unknown> },
  ) {
    return this.companyService.createTemplate(dto);
  }

  @MessagePattern(Patterns.TEMPLATE_UPDATE)
  updateTemplate(
    @Payload()
    dto: { templateId: string; userId: string; name?: string; fields?: Record<string, unknown> },
  ) {
    const { templateId, userId, ...rest } = dto;
    return this.companyService.updateTemplate(templateId, userId, rest);
  }

  @MessagePattern(Patterns.TEMPLATE_DELETE)
  deleteTemplate(@Payload() { templateId, userId }: { templateId: string; userId: string }) {
    return this.companyService.deleteTemplate(templateId, userId);
  }
}

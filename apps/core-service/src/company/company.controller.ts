import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { Patterns } from '@geo/contracts';
import { CompanyService } from './services/company.service';
import { FieldOverrides } from './entities/company-default.entity';
import { CompanyStatus } from './entities/company.entity';
import { PlatformStatus } from './entities/company-platform.entity';

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
  get(@Payload() { companyId, brandId, userId }: { companyId: string; brandId: string; userId: string }) {
    return this.companyService.get(companyId, userId, brandId);
  }

  @MessagePattern(Patterns.COMPANY_CREATE)
  create(
    @Payload()
    dto: {
      brandId: string;
      userId: string;
      name?: string;
      status?: CompanyStatus;
      code?: string;
      twoGisOrgId?: string;
      templateId?: string;
      groups?: { id?: string; name?: string }[];
      fieldOverrides?: FieldOverrides;
    },
  ) {
    return this.companyService.create(dto);
  }

  @MessagePattern(Patterns.COMPANY_FIND_BY_TWOGIS_ORG_ID)
  findByTwoGisOrgId(@Payload() { orgId }: { orgId: string }) {
    return this.companyService.findByTwoGisOrgId(orgId);
  }

  @MessagePattern(Patterns.COMPANY_DELETE)
  delete(@Payload() { companyId, brandId, userId }: { companyId: string; brandId: string; userId: string }) {
    return this.companyService.delete(companyId, userId, brandId);
  }

  @MessagePattern(Patterns.COMPANY_PLATFORMS_GET)
  getPlatforms(@Payload() { companyId, brandId, userId }: { companyId: string; brandId: string; userId: string }) {
    return this.companyService.getPlatforms(companyId, userId, brandId);
  }

  @MessagePattern(Patterns.COMPANY_DEFAULT_UPDATE)
  updateDefault(
    @Payload()
    dto: {
      companyId: string;
      brandId: string;
      userId: string;
      templateId?: string | null;
      fields?: FieldOverrides;
    },
  ) {
    const { companyId, brandId, userId, ...rest } = dto;
    return this.companyService.updateDefault(companyId, userId, rest, brandId);
  }

  @MessagePattern(Patterns.COMPANY_PLATFORM_UPDATE)
  updatePlatform(
    @Payload()
    dto: {
      companyId: string;
      brandId: string;
      userId: string;
      platformKey: string;
      isEnabled?: boolean;
      orgId?: string | null;
      orgName?: string | null;
      status?: PlatformStatus;
    },
  ) {
    const { companyId, brandId, userId, platformKey, ...rest } = dto;
    return this.companyService.updatePlatform(companyId, userId, platformKey, rest, brandId);
  }

  // ── Groups ────────────────────────────────────────────────────────────────

  @MessagePattern(Patterns.GROUP_LIST)
  listGroups(@Payload() { brandId, userId, search }: { brandId: string; userId: string; search?: string }) {
    return this.companyService.listGroups(brandId, userId, search);
  }

  @MessagePattern(Patterns.GROUP_LIST_STATS)
  listGroupsStats(@Payload() { brandId, userId, search }: { brandId: string; userId: string; search?: string }) {
    return this.companyService.listGroupsStats(userId, brandId, search);
  }

  @MessagePattern(Patterns.GROUP_REMOVE_COMPANIES)
  removeCompaniesFromGroup(
    @Payload() { groupId, brandId, userId, companyIds }: { groupId: string; brandId: string; userId: string; companyIds: string[] },
  ) {
    return this.companyService.removeCompaniesFromGroup(groupId, userId, companyIds, brandId);
  }

  @MessagePattern(Patterns.GROUP_ADD_COMPANIES)
  addCompaniesToGroup(
    @Payload() { groupId, brandId, userId, companyIds }: { groupId: string; brandId: string; userId: string; companyIds: string[] },
  ) {
    return this.companyService.addCompaniesToGroup(groupId, userId, companyIds, brandId);
  }

  @MessagePattern(Patterns.GROUP_GET)
  getGroup(@Payload() { groupId, brandId, userId }: { groupId: string; brandId: string; userId: string }) {
    return this.companyService.getGroup(groupId, userId, brandId);
  }

  @MessagePattern(Patterns.GROUP_CREATE)
  createGroup(@Payload() dto: { brandId: string; userId: string; name: string }) {
    return this.companyService.createGroup(dto);
  }

  @MessagePattern(Patterns.GROUP_UPDATE)
  updateGroup(@Payload() { groupId, brandId, userId, name }: { groupId: string; brandId: string; userId: string; name: string }) {
    return this.companyService.updateGroup(groupId, userId, name, brandId);
  }

  @MessagePattern(Patterns.GROUP_DELETE)
  deleteGroup(@Payload() { groupId, brandId, userId }: { groupId: string; brandId: string; userId: string }) {
    return this.companyService.deleteGroup(groupId, userId, brandId);
  }

  @MessagePattern(Patterns.COMPANY_MAIN_DATA_GET)
  getMainData(@Payload() { companyId, brandId, userId }: { companyId: string; brandId: string; userId: string }) {
    return this.companyService.getMainData(companyId, userId, brandId);
  }

  @MessagePattern(Patterns.COMPANY_GROUPS_UPDATE)
  updateCompanyGroups(
    @Payload() { companyId, brandId, userId, groupIds }: { companyId: string; brandId: string; userId: string; groupIds: string[] },
  ) {
    return this.companyService.updateCompanyGroups(companyId, userId, groupIds, brandId);
  }

  // ── Templates ─────────────────────────────────────────────────────────────

  @MessagePattern(Patterns.TEMPLATE_LIST)
  listTemplates(@Payload() { brandId, userId }: { brandId: string; userId: string }) {
    return this.companyService.listTemplates(brandId, userId);
  }

  @MessagePattern(Patterns.TEMPLATE_LIST_STATS)
  listTemplatesStats(@Payload() { brandId, userId }: { brandId: string; userId: string }) {
    return this.companyService.listTemplatesStats(userId, brandId);
  }

  @MessagePattern(Patterns.TEMPLATE_GET)
  getTemplate(@Payload() { templateId, brandId, userId }: { templateId: string; brandId: string; userId: string }) {
    return this.companyService.getTemplate(templateId, userId, brandId);
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
    dto: { templateId: string; brandId: string; userId: string; name?: string; fields?: Record<string, unknown> },
  ) {
    const { templateId, brandId, userId, ...rest } = dto;
    return this.companyService.updateTemplate(templateId, userId, rest, brandId);
  }

  @MessagePattern(Patterns.TEMPLATE_DELETE)
  deleteTemplate(@Payload() { templateId, brandId, userId }: { templateId: string; brandId: string; userId: string }) {
    return this.companyService.deleteTemplate(templateId, userId, brandId);
  }
}

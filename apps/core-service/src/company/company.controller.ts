import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { Patterns } from '@geo/contracts';
import { CompanyService } from './company.service';
import { CompanyCard } from './company-card.entity';

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
    },
  ) {
    return this.companyService.create(dto);
  }

  @MessagePattern(Patterns.COMPANY_FIND_BY_TWOGIS_ORG_ID)
  findByTwoGisOrgId(@Payload() { orgId }: { orgId: string }) {
    return this.companyService.findByTwoGisOrgId(orgId);
  }

  @MessagePattern(Patterns.COMPANY_GET_CARD)
  getCard(@Payload() { companyId, userId }: { companyId: string; userId: string }) {
    return this.companyService.getCard(companyId, userId);
  }

  @MessagePattern(Patterns.COMPANY_UPDATE_CARD)
  updateCard(
    @Payload()
    dto: {
      companyId: string;
      userId: string;
      fields: Partial<Omit<CompanyCard, 'companyId' | 'updatedAt'>>;
    },
  ) {
    return this.companyService.updateCard(dto.companyId, dto.userId, dto.fields);
  }
}

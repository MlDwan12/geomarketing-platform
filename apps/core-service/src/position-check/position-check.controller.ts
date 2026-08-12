import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { Patterns } from '@geo/contracts';
import { TrackedKeywordService } from './services/tracked-keyword.service';

@Controller()
export class PositionCheckController {
  constructor(private readonly keywords: TrackedKeywordService) {}

  @MessagePattern(Patterns.POSITION_KEYWORDS_ADD)
  addKeyword(
    @Payload()
    {
      companyId,
      brandId,
      userId,
      keyword,
    }: {
      companyId: string;
      brandId: string;
      userId: string;
      keyword: string;
    },
  ) {
    return this.keywords.add(companyId, brandId, userId, keyword);
  }

  @MessagePattern(Patterns.POSITION_KEYWORDS_REMOVE)
  removeKeyword(
    @Payload()
    {
      companyId,
      brandId,
      userId,
      keyword,
    }: {
      companyId: string;
      brandId: string;
      userId: string;
      keyword: string;
    },
  ) {
    return this.keywords.remove(companyId, brandId, userId, keyword);
  }

  @MessagePattern(Patterns.POSITION_KEYWORDS_LIST)
  listKeywords(
    @Payload()
    {
      companyId,
      brandId,
      userId,
    }: {
      companyId: string;
      brandId: string;
      userId: string;
    },
  ) {
    return this.keywords.listForCompany(companyId, brandId, userId);
  }
}

import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { Patterns } from '@geo/contracts';
import { TrackedKeywordService } from './services/tracked-keyword.service';
import {
  PositionCheckResultInput,
  PositionCheckResultService,
} from './services/position-check-result.service';

@Controller()
export class PositionCheckController {
  constructor(
    private readonly keywords: TrackedKeywordService,
    private readonly results: PositionCheckResultService,
  ) {}

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

  @MessagePattern(Patterns.POSITION_CHECK_SAVE)
  saveResults(
    @Payload()
    {
      companyId,
      brandId,
      userId,
      results,
    }: {
      companyId: string;
      brandId: string;
      userId: string;
      results: PositionCheckResultInput[];
    },
  ) {
    return this.results.save(companyId, brandId, userId, results);
  }

  @MessagePattern(Patterns.POSITION_CHECK_HISTORY)
  history(
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
      keyword?: string;
    },
  ) {
    return this.results.history(companyId, brandId, userId, keyword);
  }
}

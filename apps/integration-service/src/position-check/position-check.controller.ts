import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { Patterns } from '@geo/contracts';
import { PositionCheckService } from './position-check.service';
import { CompanyRef } from '../map-visibility/visibility-match';

@Controller()
export class PositionCheckController {
  constructor(private readonly positionCheck: PositionCheckService) {}

  @MessagePattern(Patterns.POSITION_CHECK_FIND)
  checkKeywords(
    @Payload()
    { company, keywords }: { company: CompanyRef; keywords: string[] },
  ) {
    return this.positionCheck.checkKeywords(company, keywords);
  }
}

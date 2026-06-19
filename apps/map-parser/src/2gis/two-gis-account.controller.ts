import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { ContactUpdate, TwoGisAccountService } from './two-gis-account.service';

@Controller('2gis/account')
export class TwoGisAccountController {
  constructor(private readonly account: TwoGisAccountService) {}

  @Put('branch/:branchId')
  updateBranch(
    @Param('branchId') branchId: string,
    @Body()
    update: { fields?: Record<string, unknown>; contacts?: ContactUpdate[] },
  ) {
    return this.account.updateBranch(branchId, update);
  }

  @Put('branches/bulk')
  bulkUpdate(
    @Body()
    body: {
      branchIds: string[];
      update: { fields?: Record<string, unknown>; contacts?: ContactUpdate[] };
    },
  ) {
    return this.account.bulkUpdateBranches(body.branchIds, body.update);
  }

  @Get('branch/:id')
  async getBranch(@Param('id') id: string) {
    return this.account.getBranchInfo(id);
  }
}

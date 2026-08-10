import {
  Body,
  Controller,
  Get,
  Param,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ContactUpdate, TwoGisAccountService } from './two-gis-account.service';
import { InternalTokenGuard } from '../common/internal-token.guard';

@Controller('2gis/account')
@UseGuards(InternalTokenGuard)
export class TwoGisAccountController {
  constructor(private readonly account: TwoGisAccountService) {}

  @Get('orgs')
  listOrgs() {
    return this.account.listOrgs();
  }

  @Get('branches')
  listBranches(
    @Query('orgId') orgId: string,
    @Query('page') page?: string,
    @Query('per_page') perPage?: string,
  ) {
    return this.account.listBranches(
      orgId,
      page ? Number(page) : 1,
      perPage ? Number(perPage) : 50,
    );
  }

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

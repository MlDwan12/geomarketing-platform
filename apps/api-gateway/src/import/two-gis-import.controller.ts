import {
  Body,
  Controller,
  HttpCode,
  Inject,
  Post,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';
import { Patterns } from '@geo/contracts';
import {
  normalizeTwoGisCatalogItem,
  toFieldOverrides,
  TwoGisCatalogItem,
} from '@geo/card-format';
import { RpcExceptionFilter } from '../filters/rpc-exception.filter';
import { SessionGuard } from '../auth/guards/session.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { sendRpc } from '../common/rpc';

const RPC_TIMEOUT = 10000;

type TwoGisOrg = {
  id: string;
  name: string;
  isActive?: boolean;
  regionName?: string;
};

type TwoGisBranch = {
  id: string;
  name: string;
  address?: string;
  address_name?: string;
};

@Controller('import/2gis')
@UseGuards(SessionGuard)
@UseFilters(RpcExceptionFilter)
export class TwoGisImportController {
  private readonly mapParserUrl: string;

  constructor(
    @Inject('CORE_SERVICE')
    private readonly coreClient: ClientProxy,
    private readonly config: ConfigService,
  ) {
    this.mapParserUrl =
      this.config.get<string>('MAP_PARSER_URL') ?? 'http://geo-map-parser:3005';
  }

  @Post()
  @HttpCode(201)
  async import(
    @Body() dto: { orgId: string; timezone?: string },
    @CurrentUser() user: { userId: string },
  ) {
    const org = await this.fetchOrg(dto.orgId);
    const branches = await this.fetchBranches(dto.orgId);

    const brand = await sendRpc(
      this.coreClient,
      Patterns.BRAND_CREATE,
      {
        name: org.name,
        timezone: dto.timezone ?? 'Europe/Moscow',
        userId: user.userId,
      },
      RPC_TIMEOUT,
    );

    const companies: unknown[] = [];

    for (const branch of branches) {
      const catalog = await this.fetchBranchCatalog(branch.id);
      const company = await sendRpc(
        this.coreClient,
        Patterns.COMPANY_CREATE,
        {
          brandId: brand.id,
          userId: user.userId,
          name: branch.name,
          twoGisOrgId: branch.id,
          addressDisplay: branch.address_name ?? branch.address ?? null,
          rating: catalog?.reviews?.general_rating ?? null,
          reviewCount: catalog?.reviews?.general_review_count ?? 0,
          coordinates: catalog?.point
            ? ([catalog.point.lon, catalog.point.lat] as [number, number])
            : null,
          fieldOverrides: catalog
            ? toFieldOverrides(normalizeTwoGisCatalogItem(catalog, branch.name))
            : undefined,
        },
        RPC_TIMEOUT,
      );
      companies.push(company);
    }

    return { brand, companies };
  }

  @Post('sync')
  @HttpCode(200)
  async sync(
    @Body() dto: { timezone?: string },
    @CurrentUser() user: { userId: string },
  ) {
    const orgs = await this.fetchAllOrgs();

    const created: { brand?: unknown; companies: unknown[] }[] = [];
    const skipped: string[] = [];

    for (const org of orgs) {
      let branches: TwoGisBranch[] = [];
      try {
        branches = await this.fetchBranches(org.id);
      } catch {
        // inactive org — branches inaccessible, import brand only
      }

      let brandId: string | null = null;
      const newCompanies: unknown[] = [];

      // check if brand already exists via any known branch
      for (const branch of branches) {
        const existing = await sendRpc(
          this.coreClient,
          Patterns.COMPANY_FIND_BY_TWOGIS_ORG_ID,
          { orgId: branch.id },
          RPC_TIMEOUT,
        );
        if (existing) {
          skipped.push(branch.id);
          if (!brandId) brandId = existing.brandId;
        }
      }

      const brandStatus = org.isActive === false ? 'suspended' : 'active';

      if (!brandId) {
        const brand = await sendRpc(
          this.coreClient,
          Patterns.BRAND_CREATE,
          {
            name: org.name,
            timezone: dto.timezone ?? 'Europe/Moscow',
            userId: user.userId,
            status: brandStatus,
          },
          RPC_TIMEOUT,
        );
        brandId = brand.id;
        created.push({ brand, companies: newCompanies });
      }

      for (const branch of branches) {
        const alreadySkipped = skipped.includes(branch.id);
        if (alreadySkipped) continue;

        const catalog = await this.fetchBranchCatalog(branch.id);
        const company = await sendRpc(
          this.coreClient,
          Patterns.COMPANY_CREATE,
          {
            brandId,
            userId: user.userId,
            name: branch.name,
            twoGisOrgId: branch.id,
            addressDisplay: branch.address_name ?? branch.address ?? null,
            rating: catalog?.reviews?.general_rating ?? null,
            reviewCount: catalog?.reviews?.general_review_count ?? 0,
            coordinates: catalog?.point
              ? ([catalog.point.lon, catalog.point.lat] as [number, number])
              : null,
            fieldOverrides: catalog
              ? toFieldOverrides(
                  normalizeTwoGisCatalogItem(catalog, branch.name),
                )
              : undefined,
          },
          RPC_TIMEOUT,
        );
        newCompanies.push(company);
      }
    }

    return {
      created,
      skipped,
      summary: {
        brandsCreated: created.length,
        companiesCreated: created.reduce((s, g) => s + g.companies.length, 0),
        companiesSkipped: skipped.length,
      },
    };
  }

  private async fetchAllOrgs(): Promise<TwoGisOrg[]> {
    const res = await fetch(`${this.mapParserUrl}/2gis/account/orgs`);

    if (!res.ok) {
      throw new Error(`Failed to fetch orgs: ${res.status}`);
    }

    const data = (await res.json()) as { result?: { items?: TwoGisOrg[] } };
    return data.result?.items ?? [];
  }

  private async fetchOrg(orgId: string): Promise<TwoGisOrg> {
    const orgs = await this.fetchAllOrgs();
    const org = orgs.find((o) => o.id === orgId);

    if (!org) {
      throw new Error(`Org ${orgId} not found in 2GIS account`);
    }

    return org;
  }

  private async fetchBranches(orgId: string): Promise<TwoGisBranch[]> {
    const url = `${this.mapParserUrl}/2gis/account/branches?orgId=${orgId}&per_page=200`;
    const res = await fetch(url);

    if (!res.ok) {
      throw new Error(`Failed to fetch branches: ${res.status}`);
    }

    const data = (await res.json()) as { result?: { items?: TwoGisBranch[] } };
    return data.result?.items ?? [];
  }

  private async fetchBranchCatalog(
    branchId: string,
  ): Promise<TwoGisCatalogItem | null> {
    try {
      const res = await fetch(
        `${this.mapParserUrl}/2gis/account/branch/${branchId}`,
      );
      if (!res.ok) return null;
      const data = (await res.json()) as {
        result?: { items?: TwoGisCatalogItem[] };
      };
      return data.result?.items?.[0] ?? null;
    } catch {
      return null;
    }
  }
}

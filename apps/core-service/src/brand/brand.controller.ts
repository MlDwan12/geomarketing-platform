import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { Patterns } from '@geo/contracts';
import { BrandService } from './brand.service';

@Controller()
export class BrandController {
  constructor(private readonly brandService: BrandService) {}

  @MessagePattern(Patterns.BRAND_LIST)
  list(@Payload() { userId }: { userId: string }) {
    return this.brandService.list(userId);
  }

  @MessagePattern(Patterns.BRAND_LIST_SHORT)
  listShort(@Payload() { userId }: { userId: string }) {
    return this.brandService.listShort(userId);
  }

  @MessagePattern(Patterns.BRAND_GET)
  get(@Payload() { brandId, userId }: { brandId: string; userId: string }) {
    return this.brandService.get(brandId, userId);
  }

  @MessagePattern(Patterns.BRAND_CREATE)
  create(
    @Payload()
    dto: {
      name: string;
      timezone: string;
      description?: string;
      logoUrl?: string;
      userId: string;
    },
  ) {
    return this.brandService.create(dto);
  }

  @MessagePattern(Patterns.BRAND_DELETE)
  delete(@Payload() { brandId, userId }: { brandId: string; userId: string }) {
    return this.brandService.delete(brandId, userId);
  }

  @MessagePattern(Patterns.BRAND_UPDATE)
  update(
    @Payload()
    dto: {
      brandId: string;
      name?: string;
      timezone?: string;
      description?: string;
      logoUrl?: string;
      userId: string;
    },
  ) {
    const { brandId, ...rest } = dto;
    return this.brandService.update(brandId, rest);
  }
}

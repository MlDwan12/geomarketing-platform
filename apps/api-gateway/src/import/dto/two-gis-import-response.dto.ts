import { ApiProperty } from '@nestjs/swagger';
import { BrandResponseDto } from '../../brands/dto/brand-response.dto';
import { CompanyResponseDto } from '../../companies/dto/company-response.dto';

export class ImportResponseDto {
  @ApiProperty({ type: BrandResponseDto })
  brand!: BrandResponseDto;

  @ApiProperty({ type: CompanyResponseDto, isArray: true })
  companies!: CompanyResponseDto[];
}

export class SyncCreatedGroupDto {
  @ApiProperty({
    type: BrandResponseDto,
    required: false,
    description:
      'Отсутствует, если бренд для этой 2ГИС-организации уже существовал (найден по twoGisOrgId одного из филиалов)',
  })
  brand?: BrandResponseDto;

  @ApiProperty({ type: CompanyResponseDto, isArray: true })
  companies!: CompanyResponseDto[];
}

export class SyncSummaryDto {
  @ApiProperty()
  brandsCreated!: number;

  @ApiProperty()
  companiesCreated!: number;

  @ApiProperty({
    description:
      'Филиалы, уже импортированные ранее (найдены по twoGisOrgId) — пропущены',
  })
  companiesSkipped!: number;
}

export class SyncResponseDto {
  @ApiProperty({ type: SyncCreatedGroupDto, isArray: true })
  created!: SyncCreatedGroupDto[];

  @ApiProperty({
    type: [String],
    description: 'id филиалов 2ГИС, пропущенных как уже импортированные',
  })
  skipped!: string[];

  @ApiProperty({ type: SyncSummaryDto })
  summary!: SyncSummaryDto;
}

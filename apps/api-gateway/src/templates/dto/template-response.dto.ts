import { ApiProperty } from '@nestjs/swagger';

// GET /templates — короткая форма для дропдаунов.
export class TemplateShortResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;
}

// GET /templates/stats
export class TemplateStatsResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ format: 'uuid' })
  brandId!: string;

  @ApiProperty()
  companiesCount!: number;
}

export class TemplateCompanyRefDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  slug!: string;
}

// GET /templates/:id
export class TemplateDetailResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description:
      'Плоские значения полей карточки: { names: [...], phones: [...], ... } ' +
      '(источник default для компаний, привязанных к шаблону)',
  })
  fields!: Record<string, unknown>;

  @ApiProperty()
  companiesCount!: number;

  @ApiProperty({ type: TemplateCompanyRefDto, isArray: true })
  companies!: TemplateCompanyRefDto[];
}

// POST /templates, PATCH /templates/:id — полная сущность CompanyTemplate.
export class TemplateEntityResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  brandId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ type: 'object', additionalProperties: true })
  fields!: Record<string, unknown>;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}

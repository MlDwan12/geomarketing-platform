import { ApiProperty } from '@nestjs/swagger';

export class TwoGisPointDto {
  @ApiProperty()
  lat!: number;

  @ApiProperty()
  lon!: number;
}

export class TwoGisRubricDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ required: false })
  alias?: string;
}

export class TwoGisContactDto {
  @ApiProperty()
  type!: string;

  @ApiProperty()
  value!: string;

  @ApiProperty({ required: false })
  comment?: string;
}

export class TwoGisContactGroupDto {
  @ApiProperty({ type: TwoGisContactDto, isArray: true, required: false })
  contacts?: TwoGisContactDto[];
}

export class TwoGisReviewsDto {
  @ApiProperty({ required: false })
  general_rating?: number;

  @ApiProperty({ required: false })
  general_review_count?: number;
}

export class TwoGisPhotoDto {
  @ApiProperty({ required: false })
  type?: string;

  @ApiProperty({ required: false })
  url?: string;
}

export class TwoGisAdmDivDto {
  @ApiProperty({ required: false })
  type?: string;

  @ApiProperty({ required: false })
  name?: string;

  @ApiProperty({ required: false })
  id?: string;
}

// Форма items[] ответа 2ГИС Places API как есть, без переименования полей
// (см. TwoGisPlaceItem в integration-service) — реально присутствующие поля
// зависят от запрошенного ?fields=.
export class TwoGisPlaceItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ required: false })
  name?: string;

  @ApiProperty({ required: false })
  type?: string;

  @ApiProperty({ required: false })
  address_name?: string;

  @ApiProperty({ required: false })
  full_address_name?: string;

  @ApiProperty({ required: false })
  address_comment?: string;

  @ApiProperty({
    type: TwoGisPointDto,
    required: false,
    description: 'Только с ?fields=point',
  })
  point?: TwoGisPointDto;

  @ApiProperty({
    type: TwoGisRubricDto,
    isArray: true,
    required: false,
    description: 'Только с ?fields=rubrics',
  })
  rubrics?: TwoGisRubricDto[];

  @ApiProperty({ required: false })
  region_id?: string;

  @ApiProperty({
    type: TwoGisContactGroupDto,
    isArray: true,
    required: false,
    description: 'Только с ?fields=contact_groups',
  })
  contact_groups?: TwoGisContactGroupDto[];

  @ApiProperty({
    required: false,
    additionalProperties: true,
    description: 'Только с ?fields=schedule',
  })
  schedule?: Record<string, unknown>;

  @ApiProperty({
    type: TwoGisReviewsDto,
    required: false,
    description: 'Только с ?fields=reviews',
  })
  reviews?: TwoGisReviewsDto;

  @ApiProperty({
    type: TwoGisPhotoDto,
    isArray: true,
    required: false,
    description: 'Только с ?fields=photos',
  })
  photos?: TwoGisPhotoDto[];

  @ApiProperty({
    type: TwoGisAdmDivDto,
    isArray: true,
    required: false,
    description: 'Только с ?fields=adm_div',
  })
  adm_div?: TwoGisAdmDivDto[];

  @ApiProperty({ required: false, description: 'Только с ?fields=description' })
  description?: string;
}

export class TwoGisSearchResponseDto {
  @ApiProperty({ type: TwoGisPlaceItemDto, isArray: true })
  items!: TwoGisPlaceItemDto[];

  @ApiProperty()
  total!: number;
}

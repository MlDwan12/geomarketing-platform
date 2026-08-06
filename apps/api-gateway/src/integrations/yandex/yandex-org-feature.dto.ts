import { ApiProperty } from '@nestjs/swagger';

export class YandexAddressComponentDto {
  @ApiProperty({ required: false })
  kind?: string;

  @ApiProperty({ required: false })
  name?: string;
}

export class YandexAddressDto {
  @ApiProperty({ required: false })
  formatted?: string;

  @ApiProperty({ required: false })
  country_code?: string;

  @ApiProperty({ required: false })
  postal_code?: string;

  @ApiProperty({
    type: YandexAddressComponentDto,
    isArray: true,
    required: false,
  })
  Components?: YandexAddressComponentDto[];
}

export class YandexCategoryDto {
  @ApiProperty({ required: false })
  class?: string;

  @ApiProperty({ required: false })
  name?: string;
}

export class YandexPhoneDto {
  @ApiProperty({ required: false })
  type?: string;

  @ApiProperty({ required: false })
  formatted?: string;
}

export class YandexHoursDto {
  @ApiProperty({
    required: false,
    description: 'Availabilities опущен как неструктурированный',
  })
  text?: string;
}

// Форма features[].properties.CompanyMetaData ответа search-maps.yandex.ru/v1
// (GeoJSON, type=biz) как есть, без переименования полей — см.
// YandexOrgFeature в integration-service.
export class YandexCompanyMetaDataDto {
  @ApiProperty({ required: false })
  id?: string;

  @ApiProperty({ required: false })
  name?: string;

  @ApiProperty({ required: false })
  address?: string;

  @ApiProperty({ type: YandexAddressDto, required: false })
  Address?: YandexAddressDto;

  @ApiProperty({ required: false })
  url?: string;

  @ApiProperty({ type: YandexCategoryDto, isArray: true, required: false })
  Categories?: YandexCategoryDto[];

  @ApiProperty({ type: YandexPhoneDto, isArray: true, required: false })
  Phones?: YandexPhoneDto[];

  @ApiProperty({ type: YandexHoursDto, required: false })
  Hours?: YandexHoursDto;
}

export class YandexGeometryDto {
  @ApiProperty({ enum: ['Point'] })
  type!: 'Point';

  @ApiProperty({
    type: [Number],
    example: [37.6, 55.75],
    description: '[lon, lat]',
  })
  coordinates!: [number, number];
}

export class YandexFeaturePropertiesDto {
  @ApiProperty({ required: false })
  name?: string;

  @ApiProperty({ required: false })
  description?: string;

  @ApiProperty({
    type: YandexCompanyMetaDataDto,
    required: false,
    description:
      'Присутствует только при type=biz (поиск организаций, не топонимов) — здесь всегда так',
  })
  CompanyMetaData?: YandexCompanyMetaDataDto;
}

export class YandexOrgFeatureDto {
  @ApiProperty({ enum: ['Feature'] })
  type!: 'Feature';

  @ApiProperty({ type: YandexGeometryDto, required: false })
  geometry?: YandexGeometryDto;

  @ApiProperty({ type: YandexFeaturePropertiesDto, required: false })
  properties?: YandexFeaturePropertiesDto;
}

export class YandexSearchResponseDto {
  @ApiProperty({ type: YandexOrgFeatureDto, isArray: true })
  items!: YandexOrgFeatureDto[];

  @ApiProperty()
  total!: number;
}

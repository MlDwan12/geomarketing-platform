import { ApiProperty } from '@nestjs/swagger';

export class PlaceSourceDto {
  @ApiProperty({ enum: ['2gis', 'yandex'] })
  provider!: '2gis' | 'yandex';

  @ApiProperty({ description: 'id организации/филиала у провайдера' })
  id!: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description:
      'Сырой объект провайдера как есть (2ГИС/Яндекс), без переименования полей',
  })
  raw!: unknown;
}

// Единая форма найденного места (2ГИС/Яндекс) — см. NormalizedPlace в
// integration-service. Может представлять и совпадение MapVisibility, и
// строку выдачи объединённого поиска.
export class NormalizedPlaceDto {
  @ApiProperty()
  name!: string;

  @ApiProperty({ required: false })
  address?: string;

  @ApiProperty({ required: false })
  phone?: string;

  @ApiProperty({
    required: false,
    type: [Number],
    description: '[lon, lat]',
    example: [37.6, 55.75],
  })
  coordinates?: [number, number];

  @ApiProperty({ required: false, type: [String] })
  categories?: string[];

  @ApiProperty({
    required: false,
    description:
      'Заполняется только когда провайдер реально отдал рейтинг (сейчас — только 2ГИС)',
  })
  rating?: number;

  @ApiProperty({ required: false })
  reviewCount?: number;

  @ApiProperty({ type: PlaceSourceDto, isArray: true })
  sources!: PlaceSourceDto[];
}

export class ProviderVisibilityDto {
  @ApiProperty({
    description: 'Найдена ли компания в публичном поиске этого провайдера',
  })
  visible!: boolean;

  @ApiProperty({ type: NormalizedPlaceDto, required: false })
  matchedItem?: NormalizedPlaceDto;

  @ApiProperty({
    enum: ['high', 'low'],
    required: false,
    description:
      'low — совпадение только по названию/адресу (нет координат у Company)',
  })
  confidence?: 'high' | 'low';

  @ApiProperty({
    required: false,
    description:
      'Поиск по этому провайдеру упал (невалидный ключ/rate limit/нет координат для 2ГИС) — не путать с visible:false',
  })
  error?: string;
}

export class CompanyVisibilityByProviderDto {
  @ApiProperty({ type: ProviderVisibilityDto })
  '2gis'!: ProviderVisibilityDto;

  @ApiProperty({ type: ProviderVisibilityDto })
  yandex!: ProviderVisibilityDto;
}

export class CompanyVisibilityResultDto {
  @ApiProperty({ format: 'uuid' })
  companyId!: string;

  @ApiProperty({ type: CompanyVisibilityByProviderDto })
  byProvider!: CompanyVisibilityByProviderDto;
}

export class CompanyVisibilityCheckResponseDto {
  @ApiProperty({ type: CompanyVisibilityResultDto, isArray: true })
  results!: CompanyVisibilityResultDto[];
}

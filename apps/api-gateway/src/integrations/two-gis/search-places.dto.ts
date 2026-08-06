import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';

// Значения без префикса "items." — как в TwoGisSearchField
// (apps/integration-service/src/two-gis/two-gis-places.service.ts).
const ALLOWED_FIELDS = [
  'point',
  'contact_groups',
  'schedule',
  'reviews',
  'photos',
  'adm_div',
  'rubrics',
  'description',
] as const;

export class SearchPlacesDto {
  @ApiProperty({ description: 'Поисковый текст' })
  @IsString()
  @IsNotEmpty()
  q!: string;

  // Формат 2ГИС: "lon,lat" (долгота первой). Хотя бы одно из location/regionId
  // нужно 2ГИС для списочного поиска — если не передать ни то, ни другое,
  // 2ГИС сам вернёт ошибку валидации, дублировать это правило здесь не стали.
  @ApiPropertyOptional({
    description:
      'Формат "lon,lat". Нужен location или regionId — иначе 2ГИС вернёт ошибку',
    example: '37.6,55.75',
  })
  @IsOptional()
  @Matches(/^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/, {
    message: 'location должен быть в формате "lon,lat"',
  })
  location?: string;

  @ApiPropertyOptional({ description: 'id региона 2ГИС' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  regionId?: number;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  // 2ГИС реально ограничивает page_size значением 1-10 (проверено живым
  // запросом), несмотря на то, что раньше здесь стоял @Max(50)/дефолт 20.
  @ApiPropertyOptional({
    default: 10,
    minimum: 1,
    maximum: 10,
    description: '2ГИС реально ограничивает 1-10',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  pageSize: number = 10;

  // ?fields=point,contact_groups,schedule — через запятую, без префикса items.
  @ApiPropertyOptional({
    type: [String],
    enum: ALLOWED_FIELDS,
    isArray: true,
    description:
      'Через запятую в query-строке, напр. "point,contact_groups,reviews"',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string'
      ? value
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : value,
  )
  @IsIn(ALLOWED_FIELDS, { each: true })
  fields?: (typeof ALLOWED_FIELDS)[number][];
}

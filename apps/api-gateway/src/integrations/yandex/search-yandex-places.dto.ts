import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class SearchYandexPlacesDto {
  @ApiProperty({ description: 'Поисковый текст' })
  @IsString()
  @IsNotEmpty()
  q!: string;

  // Формат Яндекса: "lon,lat" (долгота первой), как location у 2ГИС.
  @ApiPropertyOptional({
    description: 'Формат "lon,lat" — центр поиска',
    example: '37.6,55.75',
  })
  @IsOptional()
  @Matches(/^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/, {
    message: 'll должен быть в формате "lon,lat"',
  })
  ll?: string;

  // "lon_delta,lat_delta" — размер области поиска вокруг ll.
  @ApiPropertyOptional({
    description:
      'Формат "lon_delta,lat_delta" — размер области поиска вокруг ll',
  })
  @IsOptional()
  @Matches(/^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/, {
    message: 'spn должен быть в формате "lon_delta,lat_delta"',
  })
  spn?: string;

  @ApiPropertyOptional({ default: 10, minimum: 1, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  results: number = 10;

  @ApiPropertyOptional({ description: 'Пагинация: смещение, кратное results' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip?: number;
}

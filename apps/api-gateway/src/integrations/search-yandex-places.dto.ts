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
  @IsString()
  @IsNotEmpty()
  q: string;

  // Формат Яндекса: "lon,lat" (долгота первой), как location у 2ГИС.
  @IsOptional()
  @Matches(/^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/, {
    message: 'll должен быть в формате "lon,lat"',
  })
  ll?: string;

  // "lon_delta,lat_delta" — размер области поиска вокруг ll.
  @IsOptional()
  @Matches(/^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/, {
    message: 'spn должен быть в формате "lon_delta,lat_delta"',
  })
  spn?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  results: number = 10;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip?: number;
}

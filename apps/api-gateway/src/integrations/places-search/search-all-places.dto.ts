import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export class SearchAllPlacesDto {
  @ApiProperty({ description: 'Поисковый текст' })
  @IsString()
  @IsNotEmpty()
  q!: string;

  // Формат "lon,lat" — общий для 2ГИС и Яндекса, как и в отдельных
  // per-provider эндпоинтах (search-places.dto.ts, search-yandex-places.dto.ts).
  @ApiPropertyOptional({
    description: 'Формат "lon,lat"',
    example: '37.6,55.75',
  })
  @IsOptional()
  @Matches(/^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/, {
    message: 'location должен быть в формате "lon,lat"',
  })
  location?: string;
}

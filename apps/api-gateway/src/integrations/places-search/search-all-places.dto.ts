import { IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export class SearchAllPlacesDto {
  @IsString()
  @IsNotEmpty()
  q: string;

  // Формат "lon,lat" — общий для 2ГИС и Яндекса, как и в отдельных
  // per-provider эндпоинтах (search-places.dto.ts, search-yandex-places.dto.ts).
  @IsOptional()
  @Matches(/^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/, {
    message: 'location должен быть в формате "lon,lat"',
  })
  location?: string;
}

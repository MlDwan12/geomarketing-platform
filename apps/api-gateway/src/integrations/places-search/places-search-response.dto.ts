import { ApiProperty } from '@nestjs/swagger';
import { NormalizedPlaceDto } from '../../company-visibility/dto/company-visibility-response.dto';

export class PlacesSearchResponseDto {
  @ApiProperty({
    type: NormalizedPlaceDto,
    isArray: true,
    description:
      'Объединённые результаты 2ГИС+Яндекс, кросс-провайдерные дубли смёрджены ' +
      '(sources[] у смёрженной записи содержит обоих провайдеров)',
  })
  items!: NormalizedPlaceDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty({
    enum: ['2gis', 'yandex'],
    isArray: true,
    description:
      'Провайдеры, поиск по которым упал (невалидный ключ/rate limit) — items содержит результаты только успешных',
  })
  failedSources!: ('2gis' | 'yandex')[];
}

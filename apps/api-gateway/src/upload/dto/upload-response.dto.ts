import { ApiProperty } from '@nestjs/swagger';

export class UploadResponseDto {
  @ApiProperty({
    description: 'Абсолютный URL загруженного файла (см. /uploads static)',
  })
  url!: string;
}

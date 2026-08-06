import { ApiProperty } from '@nestjs/swagger';

export class CorePingResponseDto {
  @ApiProperty({ enum: ['core-service'] })
  service!: string;

  @ApiProperty({ enum: ['ok'] })
  status!: string;

  @ApiProperty({ format: 'date-time' })
  timestamp!: string;
}

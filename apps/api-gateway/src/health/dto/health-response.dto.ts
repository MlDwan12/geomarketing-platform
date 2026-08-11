import { ApiProperty } from '@nestjs/swagger';

export class ServiceHealthDto {
  @ApiProperty({ enum: ['ok', 'error'] })
  status!: 'ok' | 'error';

  @ApiProperty({ required: false })
  error?: string;
}

export class HealthServicesDto {
  @ApiProperty({ type: ServiceHealthDto })
  core!: ServiceHealthDto;

  @ApiProperty({ type: ServiceHealthDto })
  integration!: ServiceHealthDto;

  @ApiProperty({ type: ServiceHealthDto })
  ai!: ServiceHealthDto;

  @ApiProperty({ type: ServiceHealthDto })
  review!: ServiceHealthDto;

  @ApiProperty({ type: ServiceHealthDto })
  mapParser!: ServiceHealthDto;
}

export class AggregateHealthDto {
  @ApiProperty({ enum: ['ok', 'degraded'] })
  status!: 'ok' | 'degraded';

  @ApiProperty({ type: HealthServicesDto })
  services!: HealthServicesDto;
}

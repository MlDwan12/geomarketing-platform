import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsUUID } from 'class-validator';

// SEC-007: см. update-template.dto.ts — тот же класс проблемы для
// PATCH /companies/:id/default.
export class UpdateCompanyDefaultDto {
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  templateId?: string | null;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    description:
      'Мержится на уровне отдельных полей — форма { fieldKey: { value, isException? } }',
  })
  @IsOptional()
  @IsObject()
  fields?: Record<string, unknown>;
}

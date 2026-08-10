import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

// SEC-007: раньше PATCH /templates/:id принимал инлайн-тип вместо class-DTO —
// глобальный ValidationPipe({whitelist:true}) не применяется к Object-метатипу,
// поэтому клиент мог подмешать в тело лишние поля (например userId/brandId/
// templateId) и подменить доверенные значения в RPC-payload. Класс с
// декораторами закрывает это whitelist'ом.
export class UpdateTemplateDto {
  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    description:
      'Заменяет весь объект полей целиком (не мержится по ключам) — ' +
      'форма { names: {default:[...]}, phones: {default:[...]}, ... }',
  })
  @IsOptional()
  @IsObject()
  fields?: Record<string, unknown>;
}

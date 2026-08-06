import { ApiProperty } from '@nestjs/swagger';

// Плоская сущность Company (core-service), без карточки/групп/платформ —
// то, что реально возвращает GET /companies (список).
export class CompanyResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  brandId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  slug!: string;

  @ApiProperty({
    enum: [
      'draft',
      'active',
      'temporarily_closed',
      'closed',
      'suspended',
      'deleted',
    ],
  })
  status!: string;

  @ApiProperty({ nullable: true, type: String })
  code!: string | null;

  @ApiProperty({ nullable: true, type: String })
  addressDisplay!: string | null;

  @ApiProperty({
    nullable: true,
    type: [Number],
    description: '[lon, lat], заполняется при 2ГИС-импорте',
    example: [37.6, 55.75],
  })
  coordinates!: [number, number] | null;

  @ApiProperty({ nullable: true, type: Number })
  rating!: number | null;

  @ApiProperty()
  reviewCount!: number;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}

export class CompanyGroupRefDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;
}

// Карточка компании — динамический набор ключей (зависит от шаблона бренда
// и переопределений компании), см. libs/card-format/NormalizedCardFields.
// Каждое известное поле имеет форму { default: T, platforms?: {...}, isException?: boolean }.
export class CompanyCardDto {
  @ApiProperty({ nullable: true, type: String, format: 'uuid' })
  templateId!: string | null;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description:
      'Ключ — имя поля карточки (names/phones/mainCategory/schedule/...); ' +
      'значение — { default, platforms?, isException? }. Набор ключей не ' +
      'фиксирован (зависит от шаблона + переопределений компании).',
    example: {
      names: { default: [{ lang: 'ru', val: 'Кафе Пушкинъ' }] },
      phones: { default: [{ value: '+7 999 000-00-00' }] },
    },
  })
  fields!: Record<string, unknown>;
}

export class CompanyPlatformInfoDto {
  @ApiProperty({ description: 'напр. "2gis", "yandex"' })
  platformKey!: string;

  @ApiProperty()
  isEnabled!: boolean;

  @ApiProperty({
    enum: [
      'not_connected',
      'connected',
      'pending',
      'action_required',
      'disconnected',
      'error',
    ],
  })
  status!: string;
}

// GET /companies/:id — расширенная форма (плоская Company + groups/card/platformsInfo).
export class CompanyDetailResponseDto extends CompanyResponseDto {
  @ApiProperty({ type: CompanyGroupRefDto, isArray: true })
  groups!: CompanyGroupRefDto[];

  @ApiProperty({ type: CompanyCardDto })
  card!: CompanyCardDto;

  @ApiProperty({ type: CompanyPlatformInfoDto, isArray: true })
  platformsInfo!: CompanyPlatformInfoDto[];
}

export class PaginatedCompaniesResponseDto {
  @ApiProperty({ type: CompanyResponseDto, isArray: true })
  items!: CompanyResponseDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;
}

// GET /companies/:slug/main_data — плоский набор для формы редактирования
// карточки (см. CompanyService.getMainData).
export class CompanyMainDataResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ type: CompanyGroupRefDto, isArray: true })
  groups!: CompanyGroupRefDto[];

  @ApiProperty({ type: CompanyPlatformInfoDto, isArray: true })
  platformsInfo!: CompanyPlatformInfoDto[];

  @ApiProperty({ nullable: true, type: String, format: 'uuid' })
  templateId!: string | null;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description: 'card.fields + status компании (см. CompanyCardDto.fields)',
  })
  fields!: Record<string, unknown>;
}

// Полная сущность CompanyPlatform (core-service) — подключение к одной
// платформе (2ГИС/Яндекс/...).
export class CompanyPlatformResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  companyId!: string;

  @ApiProperty({ description: 'напр. "2gis", "yandex"' })
  platformKey!: string;

  @ApiProperty({
    enum: [
      'not_connected',
      'connected',
      'pending',
      'action_required',
      'disconnected',
      'error',
    ],
  })
  status!: string;

  @ApiProperty()
  isEnabled!: boolean;

  @ApiProperty({ nullable: true, type: String })
  orgId!: string | null;

  @ApiProperty({ nullable: true, type: String })
  orgName!: string | null;

  @ApiProperty({ nullable: true, type: String, format: 'date-time' })
  connectedAt!: string | null;

  @ApiProperty({ nullable: true, type: String, format: 'date-time' })
  lastSyncAt!: string | null;

  @ApiProperty({ nullable: true, type: String })
  syncError!: string | null;
}

export class UpdateCompanyGroupsResponseDto {
  @ApiProperty({ format: 'uuid' })
  companyId!: string;

  @ApiProperty({ type: String, isArray: true, format: 'uuid' })
  groupIds!: string[];
}

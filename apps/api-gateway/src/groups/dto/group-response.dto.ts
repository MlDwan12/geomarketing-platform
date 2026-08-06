import { ApiProperty } from '@nestjs/swagger';

// GET /groups — короткая форма для списков/дропдаунов.
export class GroupShortResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;
}

// GET /groups/stats — с количеством компаний.
export class GroupStatsResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ format: 'uuid' })
  brandId!: string;

  @ApiProperty()
  companiesCount!: number;
}

export class GroupCompanyRefDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;
}

// GET /groups/:id — с полным списком компаний группы.
export class GroupDetailResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  companiesCount!: number;

  @ApiProperty({ type: GroupCompanyRefDto, isArray: true })
  companies!: GroupCompanyRefDto[];
}

// POST /groups, PATCH /groups/:id — полная сущность CompanyGroup.
export class GroupEntityResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  brandId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}

export class GroupCompaniesMutationResponseDto {
  @ApiProperty({ format: 'uuid' })
  groupId!: string;

  @ApiProperty({
    description: 'Кол-во добавленных компаний (только для POST .../companies)',
  })
  added?: number;

  @ApiProperty({
    description: 'Кол-во удалённых компаний (только для DELETE .../companies)',
  })
  removed?: number;
}

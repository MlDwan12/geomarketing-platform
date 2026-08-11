import { ApiProperty } from '@nestjs/swagger';

export class RefreshResultDto {
  @ApiProperty()
  success!: boolean;

  @ApiProperty()
  reviewsCount!: number;

  @ApiProperty({ required: false })
  error?: string;
}

export class RefreshCompanyResponseDto {
  @ApiProperty({ type: RefreshResultDto, nullable: true })
  yandex!: RefreshResultDto | null;

  @ApiProperty({ type: RefreshResultDto, nullable: true })
  twogis!: RefreshResultDto | null;
}

export class ReviewDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  companyId!: string;

  @ApiProperty({ enum: ['YANDEX', 'GIS'] })
  source!: 'YANDEX' | 'GIS';

  @ApiProperty()
  externalReviewId!: string;

  @ApiProperty({ required: false, nullable: true })
  authorName?: string | null;

  @ApiProperty({ required: false, nullable: true })
  rating?: number | null;

  @ApiProperty({ required: false, nullable: true })
  text?: string | null;

  @ApiProperty({ required: false, nullable: true })
  publishedAt?: string | null;

  @ApiProperty({
    required: false,
    nullable: true,
    description: 'Ответ владельца — приходит с самой платформы как есть',
  })
  answer?: string | null;

  @ApiProperty({ required: false, nullable: true })
  answerPublishedAt?: string | null;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
}

export class SourceAggregateDto {
  @ApiProperty()
  total!: number;

  @ApiProperty()
  unanswered!: number;

  @ApiProperty({ nullable: true })
  averageRating!: number | null;
}

export class ReviewAggregatesDto {
  @ApiProperty({ type: SourceAggregateDto })
  combined!: SourceAggregateDto;

  @ApiProperty({ type: SourceAggregateDto })
  yandex!: SourceAggregateDto;

  @ApiProperty({ type: SourceAggregateDto })
  twogis!: SourceAggregateDto;
}

export class ReviewListResponseDto {
  @ApiProperty({ type: ReviewDto, isArray: true })
  reviews!: ReviewDto[];

  @ApiProperty({ type: ReviewAggregatesDto })
  aggregates!: ReviewAggregatesDto;
}

export class BrandDashboardCompanyDto {
  @ApiProperty({ format: 'uuid' })
  companyId!: string;

  @ApiProperty()
  companyName!: string;

  @ApiProperty({ type: ReviewAggregatesDto })
  aggregates!: ReviewAggregatesDto;

  @ApiProperty({
    required: false,
    description:
      'Заполнено, если чтение отзывов этой компании упало (partial success)',
  })
  error?: string;
}

export class BrandDashboardResponseDto {
  @ApiProperty({ type: BrandDashboardCompanyDto, isArray: true })
  companies!: BrandDashboardCompanyDto[];

  @ApiProperty({ description: 'Сумма неотвеченных отзывов по всей сети точек' })
  totalUnanswered!: number;
}

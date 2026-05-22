import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { Repository } from 'typeorm';
import { ReviewEntity } from './reviews/entities/review.entity';

@Injectable()
export class MapParserService {
  constructor(
    @InjectRepository(ReviewEntity)
    private readonly reviewRepository: Repository<ReviewEntity>,
  ) {}

  async upsertReviews(reviews: QueryDeepPartialEntity<ReviewEntity>[]) {
    if (!reviews.length) return;

    return this.reviewRepository.upsert(reviews, {
      conflictPaths: ['source', 'externalReviewId'],
      skipUpdateIfNoValuesChanged: true,
    });
  }

  async findByCompany(companyId: string) {
    return this.reviewRepository.find({
      where: { companyId },
      order: { publishedAt: 'DESC' },
    });
  }
}

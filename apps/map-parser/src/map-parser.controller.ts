import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { YandexParserService } from './yandex-parser/yandex-parser.service';
import { MapParserService } from './map-parser.service';
import { TwoGisParserService } from './two-gis-parser/two-gis-parser.service';
import { InternalTokenGuard } from './common/internal-token.guard';
import {
  mapTwoGisReviewToEntity,
  mapYandexReviewToEntity,
} from './reviews/map-review';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { ReviewEntity } from './reviews/entities/review.entity';

@Controller('parser')
@UseGuards(InternalTokenGuard)
export class MapParserController {
  constructor(
    private readonly parser: YandexParserService,
    private readonly mapParserService: MapParserService,
    private readonly twoGisParser: TwoGisParserService,
  ) {}

  @Get('ping')
  ping() {
    return {
      service: 'map-parser',
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  @Post('reviews')
  async parseReviews(
    @Body()
    body: {
      companyId: string;
      orgId: string;
      limit?: number;
      saveToDb?: boolean;
    },
  ) {
    const result = await this.parser.parseReviews(body);

    if (body.saveToDb && result.reviews?.length) {
      await this.mapParserService.upsertReviews(
        result.reviews
          .map((review) => mapYandexReviewToEntity(body.companyId, review))
          .filter(
            (entity): entity is QueryDeepPartialEntity<ReviewEntity> =>
              entity !== null,
          ),
      );
    }

    return result;
  }

  @Get('reviews/:companyId')
  getReviews(@Param('companyId') companyId: string) {
    return this.mapParserService.findByCompany(companyId);
  }

  @Post('2gis/reviews')
  async parseTwoGisReviews(
    @Body()
    body: {
      companyId: string;
      twoGisUrl: string;
      branchId?: string;
      limit?: number;
      saveToDb?: boolean;
    },
  ) {
    const result = await this.twoGisParser.parseReviews(body);

    if (body.saveToDb && result.reviews?.length) {
      await this.mapParserService.upsertReviews(
        result.reviews
          .map((review) => mapTwoGisReviewToEntity(body.companyId, review))
          .filter(
            (entity): entity is QueryDeepPartialEntity<ReviewEntity> =>
              entity !== null,
          ),
      );
    }

    return result;
  }
}

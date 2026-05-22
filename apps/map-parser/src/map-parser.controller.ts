import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { YandexParserService } from './yandex-parser/yandex-parser.service';
import { MapParserService } from './map-parser.service';
import { TwoGisParserService } from './two-gis-parser/two-gis-parser.service';

@Controller('parser')
export class MapParserController {
  constructor(
    private readonly parser: YandexParserService,
    private readonly mapParserService: MapParserService,
    private readonly twoGisParser: TwoGisParserService,
  ) {}

  @Post('reviews')
  parseReviews(
    @Body()
    body: {
      companyId: string;
      orgId: string;
      limit?: number;
      saveToDb?: boolean;
    },
  ) {
    return this.parser.parseReviews(body);
  }

  @Get('reviews/:companyId')
  getReviews(@Param('companyId') companyId: string) {
    return this.mapParserService.findByCompany(companyId);
  }

  @Post('2gis/reviews')
  parseTwoGisReviews(
    @Body()
    body: {
      companyId: string;
      twoGisUrl: string;
      branchId?: string;
      limit?: number;
      saveToDb?: boolean;
    },
  ) {
    return this.twoGisParser.parseReviews(body);
  }
}

import {
  Controller,
  Get,
  Headers,
  Inject,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  ApiCookieAuth,
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Patterns } from '@geo/contracts';
import { SessionGuard } from '../auth/guards/session.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { sendRpc } from '../common/rpc';
import {
  BrandDashboardResponseDto,
  RefreshCompanyResponseDto,
  ReviewListResponseDto,
} from './dto/review-response.dto';

// Сеть в 50 точек — read-only дашборд бренда батчит по 5 внутри review-service
// (см. ReviewBrandDashboardService), может занять несколько секунд на большой
// сети — тот же принцип увеличенного таймаута, что в CompanyVisibilityController.
const BRAND_DASHBOARD_TIMEOUT = 15000;
// Обновление одной компании — Playwright-скрапинг обеих платформ, без лимита
// на число отзывов (см. коммит 3 плана) — на бизнесах с сотнями отзывов
// может занять больше времени, чем дефолтный RPC-таймаут.
const REFRESH_COMPANY_TIMEOUT = 60000;

@ApiTags('reviews')
@ApiCookieAuth()
@ApiHeader({
  name: 'x-brand-id',
  required: true,
  description: 'id текущего бренда',
})
@Controller('reviews')
@UseGuards(SessionGuard)
export class ReviewsController {
  constructor(
    @Inject('REVIEW_SERVICE') private readonly reviewClient: ClientProxy,
  ) {}

  @ApiOperation({
    summary:
      'Обновить отзывы одной компании (скрапинг 2ГИС/Яндекс + сохранение)',
    description:
      'Скрапит подключённые платформы (isEnabled+orgId) и сохраняет результат. ' +
      'Партиальный успех — падение одной платформы не блокирует другую.',
  })
  @ApiParam({ name: 'companyId', format: 'uuid' })
  @ApiResponse({ status: 201, type: RefreshCompanyResponseDto })
  @Post('companies/:companyId/refresh')
  refreshCompany(
    @Param('companyId') companyId: string,
    @Headers('x-brand-id') brandId: string,
    @CurrentUser() user: { userId: string },
  ) {
    return sendRpc(
      this.reviewClient,
      Patterns.REVIEW_REFRESH_COMPANY,
      { companyId, brandId, userId: user.userId },
      REFRESH_COMPANY_TIMEOUT,
    );
  }

  @ApiOperation({
    summary:
      'Список отзывов компании + агрегаты (total/unanswered/averageRating)',
    description: 'Read-only — не триггерит скрапинг, читает уже сохранённое.',
  })
  @ApiParam({ name: 'companyId', format: 'uuid' })
  @ApiResponse({ status: 200, type: ReviewListResponseDto })
  @Get('companies/:companyId')
  listForCompany(@Param('companyId') companyId: string) {
    return sendRpc(this.reviewClient, Patterns.REVIEW_LIST_FOR_COMPANY, {
      companyId,
    });
  }

  @ApiOperation({
    summary: 'Дашборд неотвеченных отзывов по всей сети точек бренда',
    description:
      'Read-only — не триггерит скрапинг. Партиальный успех: падение чтения ' +
      'для одной компании не прерывает остальные, для неё вернётся { error }.',
  })
  @ApiResponse({ status: 200, type: BrandDashboardResponseDto })
  @Get('brand')
  brandDashboard(
    @Headers('x-brand-id') brandId: string,
    @CurrentUser() user: { userId: string },
  ) {
    return sendRpc(
      this.reviewClient,
      Patterns.REVIEW_BRAND_DASHBOARD,
      { brandId, userId: user.userId },
      BRAND_DASHBOARD_TIMEOUT,
    );
  }
}

import {
  Controller,
  Get,
  Headers,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { SessionGuard } from '../auth/guards/session.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CompetitorAnalysisOrchestratorService } from './competitor-analysis-orchestrator.service';
import {
  BrandGenerationResultDto,
  CompetitorAnalysisReportDto,
  SavedCompetitorAnalysisReportDto,
} from './dto/competitor-analysis-response.dto';

@ApiTags('competitor-analysis')
@ApiCookieAuth()
@ApiHeader({
  name: 'x-brand-id',
  required: true,
  description: 'id текущего бренда',
})
@Controller('competitor-analysis')
@UseGuards(SessionGuard)
export class CompetitorAnalysisController {
  constructor(
    private readonly orchestrator: CompetitorAnalysisOrchestratorService,
  ) {}

  // POST /competitor-analysis/brand — сгенерировать и сохранить отчёт для
  // ВСЕХ Company бренда разом, батчами (см.
  // docs/refactor-plans/competitor-analysis-report.md, коммит 7). Роут
  // объявлен раньше ':companyId/generate' на всякий случай, но коллизии нет —
  // разное число сегментов пути ('brand' — один, ':companyId/generate' — два).
  @ApiOperation({
    summary: 'Сгенерировать отчёт по конкурентам для ВСЕХ компаний бренда',
    description:
      'Батчами по 5 компаний параллельно. Партиальный успех — падение ' +
      'генерации для одной компании (сеть/AI/скрапинг) не прерывает батч, ' +
      'для неё вернётся { success: false, error }. AI-анализ текста отзывов ' +
      'сейчас всегда null (заглушка, реальный вызов Claude не подключён — ' +
      'см. CONTEXT.md/roadmap). Может занять минуты для крупной сети.',
  })
  @ApiResponse({ status: 201, type: BrandGenerationResultDto, isArray: true })
  @Post('brand')
  generateForBrand(
    @Headers('x-brand-id') brandId: string,
    @CurrentUser() user: { userId: string },
  ) {
    return this.orchestrator.generateForBrand(brandId, user.userId);
  }

  // POST /competitor-analysis/:companyId/generate — сгенерировать и
  // сохранить новую версию CompetitorAnalysisReport для одной Company (см.
  // docs/refactor-plans/competitor-analysis-report.md, коммит 6).
  @ApiOperation({
    summary: 'Сгенерировать отчёт по конкурентам для одной компании',
    description:
      'Ищет до 5 ближайших конкурентов (радиус 1000м, та же категория) на ' +
      '2ГИС/Яндексе, сравнивает карточку/рейтинг, сохраняет новую версию ' +
      'отчёта (история не перезаписывается). textAnalysis всегда null — ' +
      'реальный вызов Claude не подключён.',
  })
  @ApiParam({ name: 'companyId', format: 'uuid' })
  @ApiResponse({ status: 201, type: SavedCompetitorAnalysisReportDto })
  @Post(':companyId/generate')
  generate(
    @Param('companyId') companyId: string,
    @Headers('x-brand-id') brandId: string,
    @CurrentUser() user: { userId: string },
  ) {
    return this.orchestrator.generateForCompany(
      companyId,
      brandId,
      user.userId,
    );
  }

  // GET /competitor-analysis/:companyId/latest — прочитать уже сохранённый
  // отчёт (последнюю версию), без повторной генерации.
  @ApiOperation({
    summary: 'Последний сохранённый отчёт по конкурентам для компании',
    description:
      'Ничего не генерирует заново — читает последнюю по createdAt запись. ' +
      'null, если отчётов для компании ещё нет.',
  })
  @ApiParam({ name: 'companyId', format: 'uuid' })
  @ApiResponse({ status: 200, type: CompetitorAnalysisReportDto })
  @Get(':companyId/latest')
  getLatest(
    @Param('companyId') companyId: string,
    @Headers('x-brand-id') brandId: string,
    @CurrentUser() user: { userId: string },
  ) {
    return this.orchestrator.getLatestReport(companyId, brandId, user.userId);
  }
}

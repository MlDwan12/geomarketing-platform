import { Controller, Headers, Param, Post, UseGuards } from '@nestjs/common';
import { SessionGuard } from '../auth/guards/session.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CompetitorAnalysisOrchestratorService } from './competitor-analysis-orchestrator.service';

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
}

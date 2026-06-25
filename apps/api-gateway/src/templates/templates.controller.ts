import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { Patterns } from '@geo/contracts';
import { firstValueFrom, timeout } from 'rxjs';
import { RpcExceptionFilter } from '../filters/rpc-exception.filter';
import { SessionGuard } from '../auth/guards/session.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

const RPC_TIMEOUT = 5000;

@Controller('templates')
@UseGuards(SessionGuard)
@UseFilters(RpcExceptionFilter)
export class TemplatesController {
  constructor(
    @Inject('CORE_SERVICE')
    private readonly coreClient: ClientProxy,
  ) {}

  // GET /templates  — короткий список [{ id, name }] для дропдаунов (x-brand-id)
  @Get()
  list(
    @Headers('x-brand-id') brandId: string,
    @CurrentUser() user: { userId: string },
  ) {
    return firstValueFrom(
      this.coreClient
        .send(Patterns.TEMPLATE_LIST, { brandId, userId: user.userId })
        .pipe(timeout(RPC_TIMEOUT)),
    );
  }

  // GET /templates/stats — все шаблоны текущего бренда с кол. компаний
  @Get('stats')
  listStats(
    @Headers('x-brand-id') brandId: string,
    @CurrentUser() user: { userId: string },
  ) {
    return firstValueFrom(
      this.coreClient
        .send(Patterns.TEMPLATE_LIST_STATS, { brandId, userId: user.userId })
        .pipe(timeout(RPC_TIMEOUT)),
    );
  }

  // GET /templates/:id — шаблон с полями и списком компаний
  @Get(':id')
  get(
    @Param('id') id: string,
    @Headers('x-brand-id') brandId: string,
    @CurrentUser() user: { userId: string },
  ) {
    return firstValueFrom(
      this.coreClient
        .send(Patterns.TEMPLATE_GET, { templateId: id, brandId, userId: user.userId })
        .pipe(timeout(RPC_TIMEOUT)),
    );
  }

  // POST /templates
  // Body: { name, fields }
  // fields: { names: { default: [...] }, phones: { default: [...] }, ... }
  @Post()
  @HttpCode(201)
  create(
    @Headers('x-brand-id') brandId: string,
    @Body() dto: { name: string; fields: Record<string, unknown> },
    @CurrentUser() user: { userId: string },
  ) {
    return firstValueFrom(
      this.coreClient
        .send(Patterns.TEMPLATE_CREATE, { ...dto, brandId, userId: user.userId })
        .pipe(timeout(RPC_TIMEOUT)),
    );
  }

  // PATCH /templates/:id
  // Body: { name?, fields? }
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Headers('x-brand-id') brandId: string,
    @Body() dto: { name?: string; fields?: Record<string, unknown> },
    @CurrentUser() user: { userId: string },
  ) {
    return firstValueFrom(
      this.coreClient
        .send(Patterns.TEMPLATE_UPDATE, { templateId: id, brandId, userId: user.userId, ...dto })
        .pipe(timeout(RPC_TIMEOUT)),
    );
  }

  // DELETE /templates/:id
  @Delete(':id')
  @HttpCode(204)
  delete(
    @Param('id') id: string,
    @Headers('x-brand-id') brandId: string,
    @CurrentUser() user: { userId: string },
  ) {
    return firstValueFrom(
      this.coreClient
        .send(Patterns.TEMPLATE_DELETE, { templateId: id, brandId, userId: user.userId })
        .pipe(timeout(RPC_TIMEOUT)),
    );
  }
}

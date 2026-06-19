import {
  Body,
  Controller,
  Get,
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
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';

const RPC_TIMEOUT = 5000;

@Controller('brands')
@UseGuards(SessionGuard)
@UseFilters(RpcExceptionFilter)
export class BrandsController {
  constructor(
    @Inject('CORE_SERVICE')
    private readonly coreClient: ClientProxy,
  ) {}

  @Get()
  list(@CurrentUser() user: { userId: string }) {
    return firstValueFrom(
      this.coreClient
        .send(Patterns.BRAND_LIST, { userId: user.userId })
        .pipe(timeout(RPC_TIMEOUT)),
    );
  }

  @Get('short')
  listShort(@CurrentUser() user: { userId: string }) {
    return firstValueFrom(
      this.coreClient
        .send(Patterns.BRAND_LIST_SHORT, { userId: user.userId })
        .pipe(timeout(RPC_TIMEOUT)),
    );
  }

  @Get(':id')
  get(@Param('id') id: string, @CurrentUser() user: { userId: string }) {
    return firstValueFrom(
      this.coreClient
        .send(Patterns.BRAND_GET, { brandId: id, userId: user.userId })
        .pipe(timeout(RPC_TIMEOUT)),
    );
  }

  @Post()
  @HttpCode(201)
  create(@Body() dto: CreateBrandDto, @CurrentUser() user: { userId: string }) {
    return firstValueFrom(
      this.coreClient
        .send(Patterns.BRAND_CREATE, { ...dto, userId: user.userId })
        .pipe(timeout(RPC_TIMEOUT)),
    );
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateBrandDto,
    @CurrentUser() user: { userId: string },
  ) {
    return firstValueFrom(
      this.coreClient
        .send(Patterns.BRAND_UPDATE, { brandId: id, ...dto, userId: user.userId })
        .pipe(timeout(RPC_TIMEOUT)),
    );
  }
}

import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ClientProxy } from '@nestjs/microservices';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import type { Request as ExpressRequest } from 'express';
import { Patterns } from '@geo/contracts';
import { firstValueFrom, timeout } from 'rxjs';
import { RpcExceptionFilter } from '../filters/rpc-exception.filter';
import { SessionGuard } from '../auth/guards/session.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';

const RPC_TIMEOUT = 5000;
const ALLOWED_MIME = /^image\/(jpeg|png|webp|svg\+xml)$/;

const logoStorage = diskStorage({
  destination: join(process.cwd(), 'uploads'),
  filename: (_req, file, cb) =>
    cb(null, `${crypto.randomUUID()}${extname(file.originalname).toLowerCase()}`),
});

const logoInterceptor = FileInterceptor('logo', {
  storage: logoStorage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME.test(file.mimetype)) {
      cb(new BadRequestException('Допустимые форматы: jpeg, png, webp, svg'), false);
      return;
    }
    cb(null, true);
  },
});

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
  @UseInterceptors(logoInterceptor)
  create(
    @Body() dto: CreateBrandDto,
    @UploadedFile() logo: Express.Multer.File | undefined,
    @CurrentUser() user: { userId: string },
    @Req() req: ExpressRequest,
  ) {
    const logoUrl = logo ? `${req.protocol}://${req.hostname}/uploads/${logo.filename}` : dto.logoUrl;
    return firstValueFrom(
      this.coreClient
        .send(Patterns.BRAND_CREATE, { ...dto, logoUrl, userId: user.userId })
        .pipe(timeout(RPC_TIMEOUT)),
    );
  }

  @Patch(':id')
  @UseInterceptors(logoInterceptor)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateBrandDto,
    @UploadedFile() logo: Express.Multer.File | undefined,
    @CurrentUser() user: { userId: string },
    @Req() req: ExpressRequest,
  ) {
    const logoUrl = logo ? `${req.protocol}://${req.hostname}/uploads/${logo.filename}` : dto.logoUrl;
    return firstValueFrom(
      this.coreClient
        .send(Patterns.BRAND_UPDATE, { brandId: id, ...dto, logoUrl, userId: user.userId })
        .pipe(timeout(RPC_TIMEOUT)),
    );
  }
}

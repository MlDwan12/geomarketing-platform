import {
  BadRequestException,
  Body,
  Controller,
  Delete,
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
import {
  ApiBody,
  ApiConsumes,
  ApiCookieAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import type { Request as ExpressRequest } from 'express';
import { Patterns } from '@geo/contracts';
import { RpcExceptionFilter } from '../filters/rpc-exception.filter';
import { SessionGuard } from '../auth/guards/session.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { sendRpc } from '../common/rpc';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';
import {
  BrandResponseDto,
  BrandShortResponseDto,
} from './dto/brand-response.dto';
import { existsSync, mkdirSync } from 'fs';

// Общая схема multipart-тела create/update — DTO с обычными полями + опциональный
// файл логотипа (см. logoInterceptor ниже). Nest не умеет само склеить
// class-validator DTO с @UploadedFile() в одну Swagger-схему, поэтому описываем
// вручную через @ApiBody.
const brandMultipartBody = {
  type: 'object',
  properties: {
    name: { type: 'string', maxLength: 100 },
    timezone: { type: 'string', description: 'IANA timezone' },
    description: { type: 'string' },
    logoUrl: {
      type: 'string',
      description: 'Игнорируется, если передан файл logo',
    },
    logo: {
      type: 'string',
      format: 'binary',
      description: 'jpeg/png/webp, до 2 МБ',
    },
  },
} as const;

const ALLOWED_MIME = /^image\/(jpeg|png|webp)$/;
const mimeToExt: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

const uploadPath = join(process.cwd(), 'uploads');

if (!existsSync(uploadPath)) {
  mkdirSync(uploadPath, { recursive: true });
}

const logoStorage = diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadPath);
  },
  filename: (_req, file, cb) => {
    cb(null, `${crypto.randomUUID()}${mimeToExt[file.mimetype]}`);
  },
});

const logoInterceptor = FileInterceptor('logo', {
  storage: logoStorage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME.test(file.mimetype)) {
      return cb(
        new BadRequestException('Допустимые форматы: jpeg, png, webp'),
        false,
      );
    }

    cb(null, true);
  },
});
@ApiTags('brands')
@ApiCookieAuth()
@Controller('brands')
@UseGuards(SessionGuard)
@UseFilters(RpcExceptionFilter)
export class BrandsController {
  constructor(
    @Inject('CORE_SERVICE')
    private readonly coreClient: ClientProxy,
  ) {}

  @ApiOperation({ summary: 'Список брендов текущего пользователя' })
  @ApiResponse({ status: 200, type: BrandResponseDto, isArray: true })
  @Get()
  list(@CurrentUser() user: { userId: string }) {
    return sendRpc(this.coreClient, Patterns.BRAND_LIST, {
      userId: user.userId,
    });
  }

  @ApiOperation({
    summary: 'Короткий список брендов для дропдаунов/переключателя',
  })
  @ApiResponse({ status: 200, type: BrandShortResponseDto, isArray: true })
  @Get('short')
  listShort(@CurrentUser() user: { userId: string }) {
    return sendRpc(this.coreClient, Patterns.BRAND_LIST_SHORT, {
      userId: user.userId,
    });
  }

  @ApiOperation({ summary: 'Получить бренд по id' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: BrandResponseDto })
  @ApiResponse({ status: 403, description: 'Нет доступа к бренду' })
  @ApiResponse({ status: 404, description: 'Бренд не найден/удалён' })
  @Get(':id')
  get(@Param('id') id: string, @CurrentUser() user: { userId: string }) {
    return sendRpc(this.coreClient, Patterns.BRAND_GET, {
      brandId: id,
      userId: user.userId,
    });
  }

  @ApiOperation({
    summary: 'Создать бренд',
    description:
      'Пользователь становится владельцем (ownerId). Слаг генерируется из name.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: brandMultipartBody })
  @ApiResponse({ status: 201, type: BrandResponseDto })
  @Post()
  @HttpCode(201)
  @UseInterceptors(logoInterceptor)
  create(
    @Body() dto: CreateBrandDto,
    @UploadedFile() logo: Express.Multer.File | undefined,
    @CurrentUser() user: { userId: string },
    @Req() req: ExpressRequest,
  ) {
    const logoUrl = logo
      ? `${req.protocol}://${req.get('host')}/uploads/${logo.filename}`
      : dto.logoUrl;

    return sendRpc(this.coreClient, Patterns.BRAND_CREATE, {
      ...dto,
      logoUrl,
      userId: user.userId,
    });
  }

  @ApiOperation({
    summary: 'Удалить бренд (мягко, status=deleted)',
    description: 'Только владелец (ownerId) может удалить бренд.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Удалён' })
  @ApiResponse({ status: 403, description: 'Не владелец бренда' })
  @ApiResponse({ status: 404, description: 'Бренд не найден/уже удалён' })
  @Delete(':id')
  @HttpCode(204)
  delete(@Param('id') id: string, @CurrentUser() user: { userId: string }) {
    return sendRpc(this.coreClient, Patterns.BRAND_DELETE, {
      brandId: id,
      userId: user.userId,
    });
  }

  @ApiOperation({ summary: 'Частично обновить бренд' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: brandMultipartBody })
  @ApiResponse({ status: 200, type: BrandResponseDto })
  @ApiResponse({ status: 404, description: 'Бренд не найден/удалён' })
  @Patch(':id')
  @UseInterceptors(logoInterceptor)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateBrandDto,
    @UploadedFile() logo: Express.Multer.File | undefined,
    @CurrentUser() user: { userId: string },
    @Req() req: ExpressRequest,
  ) {
    const logoUrl = logo
      ? `${req.protocol}://${req.hostname}/uploads/${logo.filename}`
      : dto.logoUrl;
    return sendRpc(this.coreClient, Patterns.BRAND_UPDATE, {
      brandId: id,
      ...dto,
      logoUrl,
      userId: user.userId,
    });
  }
}

import {
  BadRequestException,
  Body,
  CallHandler,
  Controller,
  Delete,
  ExecutionContext,
  Get,
  HttpCode,
  Inject,
  NestInterceptor,
  Param,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Observable } from 'rxjs';

class DebugBodyInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest();
    console.log(
      '[DEBUG body after multer]',
      req.body,
      '| file:',
      req.file?.originalname,
    );
    return next.handle();
  }
}
import { FileInterceptor } from '@nestjs/platform-express';
import { ClientProxy } from '@nestjs/microservices';
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
import { existsSync, mkdirSync } from 'fs';

const ALLOWED_MIME = /^image\/(jpeg|png|webp|svg\+xml)$/;
const mimeToExt: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/svg+xml': '.svg',
};

const uploadPath = join(process.cwd(), 'uploads');

if (!existsSync(uploadPath)) {
  mkdirSync(uploadPath, { recursive: true });
}

const logoStorage = diskStorage({
  destination: (_req, _file, cb) => {
    console.log('MULTER DESTINATION:', uploadPath);
    cb(null, uploadPath);
  },
  filename: (_req, file, cb) => {
    console.log('MULTER FILENAME:', file.mimetype);
    cb(null, `${crypto.randomUUID()}${mimeToExt[file.mimetype]}`);
  },
});

const logoInterceptor = FileInterceptor('logo', {
  storage: logoStorage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    console.log('MULTER FILE:', file);

    if (!ALLOWED_MIME.test(file.mimetype)) {
      return cb(
        new BadRequestException('Допустимые форматы: jpeg, png, webp, svg'),
        false,
      );
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
    return sendRpc(this.coreClient, Patterns.BRAND_LIST, {
      userId: user.userId,
    });
  }

  @Get('short')
  listShort(@CurrentUser() user: { userId: string }) {
    return sendRpc(this.coreClient, Patterns.BRAND_LIST_SHORT, {
      userId: user.userId,
    });
  }

  @Get(':id')
  get(@Param('id') id: string, @CurrentUser() user: { userId: string }) {
    return sendRpc(this.coreClient, Patterns.BRAND_GET, {
      brandId: id,
      userId: user.userId,
    });
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
    console.log('CREATE CALLED');
    console.log('BODY:', dto);
    console.log('LOGO:', logo);

    const logoUrl = logo
      ? `${req.protocol}://${req.get('host')}/uploads/${logo.filename}`
      : dto.logoUrl;

    return sendRpc(this.coreClient, Patterns.BRAND_CREATE, {
      ...dto,
      logoUrl,
      userId: user.userId,
    });
  }

  @Delete(':id')
  @HttpCode(204)
  delete(@Param('id') id: string, @CurrentUser() user: { userId: string }) {
    return sendRpc(this.coreClient, Patterns.BRAND_DELETE, {
      brandId: id,
      userId: user.userId,
    });
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

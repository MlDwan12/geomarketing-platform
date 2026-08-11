import {
  BadRequestException,
  Controller,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import type { Request as ExpressRequest } from 'express';
import { SessionGuard } from '../auth/guards/session.guard';
import { UploadResponseDto } from './dto/upload-response.dto';

const ALLOWED_MIME = /^image\/(jpeg|png|webp)$/;
const MAX_SIZE = 2 * 1024 * 1024; // 2 MB

@ApiTags('upload')
@ApiCookieAuth()
@Controller('upload')
@UseGuards(SessionGuard)
export class UploadController {
  @ApiOperation({
    summary: 'Загрузить изображение (лого бренда/аватар)',
    description:
      'Возвращает URL — дальше передаётся в POST/PATCH /brands (logoUrl) или PATCH /auth/avatar.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'jpeg/png/webp, до 2 МБ',
        },
      },
    },
  })
  @ApiResponse({ status: 201, type: UploadResponseDto })
  @ApiResponse({
    status: 400,
    description: 'Файл не передан или недопустимый формат',
  })
  @Post('logo')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: join(process.cwd(), 'uploads'),
        filename: (_req, file, cb) => {
          const unique = crypto.randomUUID();
          cb(null, `${unique}${extname(file.originalname).toLowerCase()}`);
        },
      }),
      limits: { fileSize: MAX_SIZE },
      fileFilter: (_req, file, cb) => {
        if (!ALLOWED_MIME.test(file.mimetype)) {
          cb(
            new BadRequestException('Допустимые форматы: jpeg, png, webp'),
            false,
          );
          return;
        }
        cb(null, true);
      },
    }),
  )
  upload(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: ExpressRequest,
  ) {
    if (!file) throw new BadRequestException('Файл не передан');
    const base = `${req.protocol}://${req.hostname}`;
    return { url: `${base}/uploads/${file.filename}` };
  }
}

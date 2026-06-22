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
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import type { Request as ExpressRequest } from 'express';
import { SessionGuard } from '../auth/guards/session.guard';

const ALLOWED_MIME = /^image\/(jpeg|png|webp|svg\+xml)$/;
const MAX_SIZE = 2 * 1024 * 1024; // 2 MB

@Controller('upload')
@UseGuards(SessionGuard)
export class UploadController {
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
          cb(new BadRequestException('Допустимые форматы: jpeg, png, webp, svg'), false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  upload(@UploadedFile() file: Express.Multer.File, @Req() req: ExpressRequest) {
    if (!file) throw new BadRequestException('Файл не передан');
    const base = `${req.protocol}://${req.hostname}`;
    return { url: `${base}/uploads/${file.filename}` };
  }
}

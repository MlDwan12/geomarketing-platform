import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Brand } from './brand.entity';
import { UserBrand } from './user-brand.entity';
import { BrandController } from './brand.controller';
import { BrandService } from './brand.service';

@Module({
  imports: [TypeOrmModule.forFeature([Brand, UserBrand])],
  controllers: [BrandController],
  providers: [BrandService],
})
export class BrandModule {}

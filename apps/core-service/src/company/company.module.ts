import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Company } from './company.entity';
import { CompanyCard } from './company-card.entity';
import { CompanyPlatform } from './company-platform.entity';
import { UserBrand } from '../brand/user-brand.entity';
import { CompanyController } from './company.controller';
import { CompanyService } from './company.service';

@Module({
  imports: [TypeOrmModule.forFeature([Company, CompanyCard, CompanyPlatform, UserBrand])],
  controllers: [CompanyController],
  providers: [CompanyService],
})
export class CompanyModule {}

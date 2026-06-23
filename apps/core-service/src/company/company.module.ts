import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Company } from './company.entity';
import { CompanyDefault } from './company-default.entity';
import { CompanyTemplate } from './company-template.entity';
import { CompanyPlatform } from './company-platform.entity';
import { UserBrand } from '../brand/user-brand.entity';
import { CompanyController } from './company.controller';
import { CompanyService } from './company.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Company,
      CompanyDefault,
      CompanyTemplate,
      CompanyPlatform,
      UserBrand,
    ]),
  ],
  controllers: [CompanyController],
  providers: [CompanyService],
})
export class CompanyModule {}

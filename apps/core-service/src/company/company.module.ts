import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Company } from './company.entity';
import { CompanyDefault } from './company-default.entity';
import { CompanyTemplate } from './company-template.entity';
import { CompanyPlatform } from './company-platform.entity';
import { CompanyGroup } from './company-group.entity';
import { CompanyGroupMember } from './company-group-member.entity';
import { UserBrand } from '../brand/user-brand.entity';
import { CompanyController } from './company.controller';
import { CompanyService } from './company.service';
import { CompanyAccessService } from './company-access.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Company,
      CompanyDefault,
      CompanyTemplate,
      CompanyPlatform,
      CompanyGroup,
      CompanyGroupMember,
      UserBrand,
    ]),
  ],
  controllers: [CompanyController],
  providers: [CompanyService, CompanyAccessService],
})
export class CompanyModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Company } from './entities/company.entity';
import { CompanyDefault } from './entities/company-default.entity';
import { CompanyTemplate } from './entities/company-template.entity';
import { CompanyPlatform } from './entities/company-platform.entity';
import { CompanyGroup } from './entities/company-group.entity';
import { CompanyGroupMember } from './entities/company-group-member.entity';
import { UserBrand } from '../brand/user-brand.entity';
import { CompanyController } from './company.controller';
import { CompanyService } from './services/company.service';
import { CompanyAccessService } from './services/company-access.service';
import { CompanyTemplateService } from './services/company-template.service';
import { CompanyGroupService } from './services/company-group.service';
import { CompanyPlatformService } from './services/company-platform.service';

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
  providers: [
    CompanyService,
    CompanyAccessService,
    CompanyTemplateService,
    CompanyGroupService,
    CompanyPlatformService,
  ],
  exports: [CompanyAccessService],
})
export class CompanyModule {}

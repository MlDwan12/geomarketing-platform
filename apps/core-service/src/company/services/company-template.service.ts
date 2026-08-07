import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { RpcException } from '@nestjs/microservices';
import { Company } from '../entities/company.entity';
import { CompanyDefault } from '../entities/company-default.entity';
import { CompanyTemplate } from '../entities/company-template.entity';
import { CompanyAccessService } from './company-access.service';
import { BrandRole } from '../../brand/user-brand.entity';

@Injectable()
export class CompanyTemplateService {
  constructor(
    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,
    @InjectRepository(CompanyDefault)
    private readonly defaultRepo: Repository<CompanyDefault>,
    @InjectRepository(CompanyTemplate)
    private readonly templateRepo: Repository<CompanyTemplate>,
    private readonly dataSource: DataSource,
    private readonly access: CompanyAccessService,
  ) {}

  async listTemplates(brandId: string, userId: string) {
    await this.access.assertBrandAccess(brandId, userId);
    const templates = await this.templateRepo.find({
      where: { brandId },
      order: { createdAt: 'ASC' },
    });
    return templates.map((t) => ({ id: t.id, name: t.name }));
  }

  async listTemplatesStats(userId: string, brandId: string) {
    await this.access.assertBrandAccess(brandId, userId);

    const rows: {
      id: string;
      name: string;
      brandId: string;
      companiesCount: string;
    }[] = await this.dataSource.query(
      `SELECT t.id, t.name, t."brandId", COUNT(d."companyId")::int AS "companiesCount"
         FROM company_templates t
         LEFT JOIN company_defaults d ON d."templateId" = t.id
         WHERE t."brandId" = $1
         GROUP BY t.id
         ORDER BY t."createdAt" ASC`,
      [brandId],
    );

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      brandId: r.brandId,
      companiesCount: Number(r.companiesCount),
    }));
  }

  async getTemplate(templateId: string, userId: string, brandId: string) {
    const template = await this.templateRepo.findOne({
      where: { id: templateId },
    });
    if (!template || template.brandId !== brandId)
      throw new RpcException({ status: 404, message: 'Template not found' });
    await this.access.assertBrandAccess(brandId, userId);

    const defaults = await this.defaultRepo.find({ where: { templateId } });
    const companies = defaults.length
      ? await this.companyRepo.find({
          where: { id: In(defaults.map((d) => d.companyId)) },
        })
      : [];

    return {
      id: template.id,
      name: template.name,
      fields: template.fields,
      companiesCount: companies.length,
      companies: companies.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
      })),
    };
  }

  async createTemplate(dto: {
    brandId: string;
    userId: string;
    name: string;
    fields: Record<string, unknown>;
  }) {
    await this.access.assertBrandAccess(
      dto.brandId,
      dto.userId,
      BrandRole.Manager,
    );
    return this.templateRepo.save(
      this.templateRepo.create({
        brandId: dto.brandId,
        name: dto.name,
        fields: dto.fields,
      }),
    );
  }

  async updateTemplate(
    templateId: string,
    userId: string,
    dto: { name?: string; fields?: Record<string, unknown> },
    brandId: string,
  ) {
    const template = await this.templateRepo.findOne({
      where: { id: templateId },
    });

    if (!template || template.brandId !== brandId) {
      throw new RpcException({ status: 404, message: 'Template not found' });
    }

    await this.access.assertBrandAccess(brandId, userId, BrandRole.Manager);
    Object.assign(template, dto);
    return this.templateRepo.save(template);
  }

  async deleteTemplate(templateId: string, userId: string, brandId: string) {
    const template = await this.templateRepo.findOne({
      where: { id: templateId },
    });

    if (!template || template.brandId !== brandId) {
      throw new RpcException({ status: 404, message: 'Template not found' });
    }

    await this.access.assertBrandAccess(brandId, userId, BrandRole.Manager);

    // Detach companies before deleting so they don't lose their data
    await this.defaultRepo.update({ templateId }, { templateId: null });
    await this.templateRepo.remove(template);
    return null;
  }
}

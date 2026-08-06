import { Entity, PrimaryColumn } from 'typeorm';

@Entity('company_group_members')
export class CompanyGroupMember {
  @PrimaryColumn({ type: 'uuid' })
  groupId!: string;

  @PrimaryColumn({ type: 'uuid' })
  companyId!: string;
}

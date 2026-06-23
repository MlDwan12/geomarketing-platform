import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

export interface FieldOverride<T = unknown> {
  isException: boolean;
  value?: T;
  platforms?: Record<string, T>;
}

export type FieldOverrides = Record<string, FieldOverride>;

@Entity('company_defaults')
export class CompanyDefault {
  @PrimaryColumn({ type: 'uuid' })
  companyId: string;

  @Column({ type: 'uuid', nullable: true })
  templateId: string | null;

  // Per-field overrides:
  // { fieldName: { isException, value?, platforms?: { platformKey: value } } }
  @Column({ type: 'jsonb', default: '{}' })
  fieldOverrides: FieldOverrides;

  @UpdateDateColumn()
  updatedAt: Date;
}

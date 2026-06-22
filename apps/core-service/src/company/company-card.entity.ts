import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('company_cards')
export class CompanyCard {
  @PrimaryColumn({ type: 'uuid' })
  companyId: string;

  @Column({ type: 'jsonb', nullable: true })
  names: unknown;

  @Column({ type: 'jsonb', nullable: true })
  shortNames: unknown;

  @Column({ type: 'jsonb', nullable: true })
  altNames: unknown;

  @Column({ type: 'jsonb', nullable: true })
  email: unknown;

  @Column({ type: 'jsonb', nullable: true })
  phones: unknown;

  @Column({ type: 'jsonb', nullable: true })
  address: unknown;

  @Column({ type: 'jsonb', nullable: true })
  websites: unknown;

  @Column({ type: 'jsonb', nullable: true })
  socials: unknown;

  @Column({ type: 'jsonb', nullable: true })
  mainCategory: unknown;

  @Column({ type: 'jsonb', nullable: true })
  additionalCategories: unknown;

  @Column({ type: 'jsonb', nullable: true })
  descriptions: unknown;

  @Column({ type: 'jsonb', nullable: true })
  shortDescriptions: unknown;

  @Column({ type: 'jsonb', nullable: true })
  schedule: unknown;

  @Column({ type: 'jsonb', nullable: true })
  specialDays: unknown;

  @UpdateDateColumn()
  updatedAt: Date;
}

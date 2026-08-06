import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('company_templates')
export class CompanyTemplate {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  brandId!: string;

  @Column({ length: 255 })
  name!: string;

  // Flat field values: { names: [...], phones: [...], address: {...}, ... }
  @Column({ type: 'jsonb', default: '{}' })
  fields: Record<string, unknown> = {};

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

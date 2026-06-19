import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum BrandStatus {
  Active = 'active',
  Suspended = 'suspended',
  Deleted = 'deleted',
}

@Entity('brands')
export class Brand {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  name: string;

  @Column({ length: 120, unique: true })
  slug: string;

  @Column({ type: 'uuid' })
  ownerId: string;

  @Column({ type: 'enum', enum: BrandStatus, default: BrandStatus.Active })
  status: BrandStatus;

  @Column({ length: 64 })
  timezone: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  logoUrl: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

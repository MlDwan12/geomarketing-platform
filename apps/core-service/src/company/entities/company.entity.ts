import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum CompanyStatus {
  Draft = 'draft',
  Active = 'active',
  TemporarilyClosed = 'temporarily_closed',
  Closed = 'closed',
  Suspended = 'suspended',
  Deleted = 'deleted',
}

@Entity('companies')
export class Company {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  brandId!: string;

  @Column({ length: 255 })
  name!: string;

  @Column({ length: 300, unique: true })
  slug!: string;

  @Column({ type: 'enum', enum: CompanyStatus, default: CompanyStatus.Draft })
  status: CompanyStatus = CompanyStatus.Draft;

  @Column({ type: 'varchar', length: 50, nullable: true })
  code: string | null = null;

  @Column({ type: 'text', nullable: true })
  addressDisplay: string | null = null;

  // [lon, lat] — для MapVisibility-сопоставления с публичным поиском 2ГИС/Яндекс.
  // Заполняется при 2ГИС-импорте (catalog.point); старые записи — null.
  @Column({ type: 'jsonb', nullable: true })
  coordinates: [number, number] | null = null;

  @Column({ type: 'numeric', precision: 3, scale: 1, nullable: true })
  rating: number | null = null;

  @Column({ type: 'int', default: 0 })
  reviewCount: number = 0;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

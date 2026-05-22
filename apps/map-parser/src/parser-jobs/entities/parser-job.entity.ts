import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type ParserJobStatus = 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED';

@Entity('parser_jobs')
export class ParserJobEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  companyId: string;

  @Column()
  source: 'YANDEX' | 'GIS';

  @Column({ type: 'text' })
  url: string;

  @Column({ type: 'varchar', default: 'PENDING' })
  status: ParserJobStatus;

  @Column({ type: 'int', default: 0 })
  parsedCount: number;

  @Column({ type: 'text', nullable: true })
  errorMessage?: string;

  @Column({ type: 'jsonb', nullable: true })
  meta?: unknown;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

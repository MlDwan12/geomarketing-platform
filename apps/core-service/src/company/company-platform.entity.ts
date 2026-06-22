import { Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

export enum PlatformType {
  Yandex = 'yandex',
  TwoGis = 'twogis',
}

export enum PlatformStatus {
  NotConnected = 'not_connected',
  Connected = 'connected',
  Pending = 'pending',
  ActionRequired = 'action_required',
  Disconnected = 'disconnected',
  Error = 'error',
}

@Entity('company_platforms')
@Unique(['companyId', 'platform'])
export class CompanyPlatform {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  companyId: string;

  @Column({ type: 'enum', enum: PlatformType })
  platform: PlatformType;

  @Column({ type: 'enum', enum: PlatformStatus, default: PlatformStatus.NotConnected })
  status: PlatformStatus;

  @Column({ default: false })
  isEnabled: boolean;

  @Column({ type: 'varchar', length: 100, nullable: true })
  orgId: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  orgName: string | null;

  @Column({ type: 'timestamp', nullable: true })
  connectedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  lastSyncAt: Date | null;

  @Column({ type: 'text', nullable: true })
  syncError: string | null;
}

import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum UserRole {
  Owner = 'owner',
  Admin = 'admin',
  Manager = 'manager',
  Viewer = 'viewer',
}

export enum UserStatus {
  Active = 'active',
  Suspended = 'suspended',
  Left = 'left',
  Pending = 'pending',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 100 })
  name!: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  fullName: string | null = null;

  @Column({ length: 254, unique: true })
  email!: string;

  @Column({ select: false })
  passwordHash!: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.Owner })
  role: UserRole = UserRole.Owner;

  @Column({ type: 'enum', enum: UserStatus, default: UserStatus.Active })
  status: UserStatus = UserStatus.Active;

  @Column({ type: 'varchar', length: 30, nullable: true })
  phone: string | null = null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  telegram: string | null = null;

  @Column({ default: false })
  twoFaEnabled: boolean = false;

  @Column({ type: 'varchar', length: 500, nullable: true })
  avatarUrl: string | null = null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  timezone: string | null = null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  locale: string | null = null;

  @Column({ type: 'varchar', length: 32, unique: true, nullable: true })
  refCode: string | null = null;

  @Column({ type: 'varchar', nullable: true })
  referredById: string | null = null;

  @Column({ type: 'timestamptz', nullable: true })
  lastLoginAt: Date | null = null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

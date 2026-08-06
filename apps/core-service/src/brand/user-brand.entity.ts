import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { UserRole, UserStatus } from '../user/user.entity';

@Entity('user_brands')
@Unique(['userId', 'brandId'])
export class UserBrand {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'uuid' })
  brandId!: string;

  @Column({ type: 'enum', enum: UserRole })
  role!: UserRole;

  @Column({ type: 'enum', enum: UserStatus, default: UserStatus.Active })
  status: UserStatus = UserStatus.Active;

  @CreateDateColumn()
  joinedAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  lastLoginAt: Date | null = null;
}

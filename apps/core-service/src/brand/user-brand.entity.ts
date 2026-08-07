import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { UserStatus } from '../user/user.entity';

// BrandRole — уровень прав участника внутри конкретного Brand (см. CONTEXT.md).
// Owner единственный на Brand (совпадает с Brand.ownerId), Manager — полный доступ
// к данным сети кроме удаления Company/настроек Brand/команды, Viewer — read-only.
export enum BrandRole {
  Owner = 'owner',
  Manager = 'manager',
  Viewer = 'viewer',
}

@Entity('user_brands')
@Unique(['userId', 'brandId'])
export class UserBrand {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'uuid' })
  brandId!: string;

  @Column({ type: 'enum', enum: BrandRole })
  role!: BrandRole;

  @Column({ type: 'enum', enum: UserStatus, default: UserStatus.Active })
  status: UserStatus = UserStatus.Active;

  @CreateDateColumn()
  joinedAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  lastLoginAt: Date | null = null;
}

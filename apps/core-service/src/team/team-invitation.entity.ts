import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { BrandRole } from '../brand/user-brand.entity';

export enum TeamInvitationStatus {
  Pending = 'pending',
  Accepted = 'accepted',
  Revoked = 'revoked',
  Expired = 'expired',
}

// Инвайт только для ещё не зарегистрированных email — принятие инвайта и есть
// регистрация (см. CONTEXT.md, docs/refactor-plans/team-brand-roles.md).
// role исключает BrandRole.Owner на уровне приложения (TeamService.invite) —
// Owner единственный, совпадает с Brand.ownerId, не назначается через инвайт.
@Entity('team_invitations')
export class TeamInvitation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  brandId!: string;

  @Column({ length: 254 })
  email!: string;

  @Column({ type: 'enum', enum: BrandRole })
  role!: BrandRole;

  @Column({ type: 'uuid' })
  invitedByUserId!: string;

  @Column({ unique: true })
  tokenHash!: string;

  @Column({ type: 'timestamp' })
  expiresAt!: Date;

  @Column({
    type: 'enum',
    enum: TeamInvitationStatus,
    default: TeamInvitationStatus.Pending,
  })
  status: TeamInvitationStatus = TeamInvitationStatus.Pending;

  @CreateDateColumn()
  createdAt!: Date;
}

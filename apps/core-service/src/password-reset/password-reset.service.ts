import { Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { IsNull, MoreThan, Repository } from 'typeorm';
import { User } from '../user/user.entity';
import { PasswordResetToken } from './password-reset-token.entity';

const TOKEN_TTL_HOURS = 1;

@Injectable()
export class PasswordResetService {
  constructor(
    @InjectRepository(PasswordResetToken)
    private readonly tokenRepo: Repository<PasswordResetToken>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async createToken(email: string): Promise<string | null> {
    const user = await this.userRepo.findOne({ where: { email } });
    if (!user) return null;

    // Инвалидируем предыдущие неиспользованные токены
    await this.tokenRepo.update(
      { userId: user.id, usedAt: IsNull() },
      { usedAt: new Date() },
    );

    const token = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + TOKEN_TTL_HOURS);

    await this.tokenRepo.save(
      this.tokenRepo.create({ userId: user.id, tokenHash, expiresAt }),
    );

    return token;
  }

  async consumeToken(token: string, newPassword: string): Promise<void> {
    const tokenHash = createHash('sha256').update(token).digest('hex');

    const record = await this.tokenRepo.findOne({
      where: {
        tokenHash,
        usedAt: IsNull(),
        expiresAt: MoreThan(new Date()),
      },
    });

    if (!record) {
      throw new RpcException({ statusCode: 400, message: 'Токен недействителен или просрочен' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.userRepo.update({ id: record.userId }, { passwordHash });
    await this.tokenRepo.update({ id: record.id }, { usedAt: new Date() });
  }
}

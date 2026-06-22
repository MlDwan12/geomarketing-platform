import { ConflictException, Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { Repository } from 'typeorm';
import { User } from './user.entity';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly repo: Repository<User>,
  ) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.repo.findOne({ where: { email } });
  }

  async validate(email: string, password: string): Promise<Omit<User, 'passwordHash'> | null> {
    const user = await this.repo
      .createQueryBuilder('u')
      .addSelect('u.passwordHash')
      .where('u.email = :email', { email })
      .getOne();

    if (!user) return null;

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return null;

    await this.repo.update({ id: user.id }, { lastLoginAt: new Date() });
    user.lastLoginAt = new Date();

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash: _, ...rest } = user;
    return rest;
  }

  async create(
    name: string,
    email: string,
    password: string,
    referralCode?: string,
  ): Promise<Omit<User, 'passwordHash'>> {
    const exists = await this.findByEmail(email);
    if (exists) {
      throw new RpcException({ statusCode: 409, message: 'Пользователь с таким email уже существует' });
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const refCode = randomBytes(6).toString('hex');

    // Если передан реферальный код — ищем реферрера. Ошибку не бросаем: невалидный код просто игнорируем.
    let referredById: string | null = null;
    if (referralCode) {
      const referrer = await this.repo.findOne({ where: { refCode: referralCode } });
      if (referrer) referredById = referrer.id;
    }

    const user = this.repo.create({ name, email, passwordHash, refCode, referredById, lastLoginAt: new Date() });
    const saved = await this.repo.save(user);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash: _, ...rest } = saved;
    return rest;
  }

  async getProfile(userId: string): Promise<User> {
    const user = await this.repo.findOne({ where: { id: userId } });
    if (!user) {
      throw new RpcException({ statusCode: 404, message: 'Пользователь не найден' });
    }
    return user;
  }

  async updateProfile(userId: string, dto: Partial<Pick<User, 'name' | 'fullName' | 'phone' | 'telegram' | 'timezone' | 'locale'>>): Promise<User> {
    await this.repo.update({ id: userId }, dto);
    return this.getProfile(userId);
  }

  async updateAvatar(userId: string, avatarUrl: string): Promise<{ avatarUrl: string }> {
    await this.repo.update({ id: userId }, { avatarUrl });
    return { avatarUrl };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.repo
      .createQueryBuilder('u')
      .addSelect('u.passwordHash')
      .where('u.id = :userId', { userId })
      .getOne();

    if (!user) {
      throw new RpcException({ statusCode: 404, message: 'Пользователь не найден' });
    }

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      throw new RpcException({ statusCode: 400, message: 'Неверный текущий пароль' });
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await this.repo.update({ id: userId }, { passwordHash });
  }
}

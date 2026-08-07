import { Injectable, OnModuleInit } from '@nestjs/common';
import { Resend } from 'resend';

// Явный шов вместо тихого no-op: если RESEND_API_KEY не задан, вызывающий
// код должен решить сам, что делать (упасть или сделать dev-фолбэк) — не
// молча "отправить в никуда". Тот же принцип, что TextAnalysisNotImplementedError
// в ai-service (см. CONTEXT.md, CompetitorAnalysisReport).
export class MailerNotConfiguredError extends Error {
  constructor() {
    super('RESEND_API_KEY is not set — mailer is not configured');
    this.name = 'MailerNotConfiguredError';
  }
}

const FROM_ADDRESS = 'onboarding@resend.dev';

@Injectable()
export class MailerService implements OnModuleInit {
  private client: Resend | null = null;

  onModuleInit(): void {
    const apiKey = process.env.RESEND_API_KEY;
    if (apiKey) {
      this.client = new Resend(apiKey);
    }
  }

  // acceptUrl — сырой токен, не ссылка: у проекта пока нет фронтенда, чтобы
  // построить реальный URL (см. docs/refactor-plans/team-brand-roles.md).
  // TODO: заменить на кликабельную ссылку на фронтенд, когда он появится.
  async sendTeamInvite(to: string, token: string): Promise<void> {
    if (!this.client) {
      throw new MailerNotConfiguredError();
    }

    await this.client.emails.send({
      from: FROM_ADDRESS,
      to,
      subject: 'Приглашение в команду',
      text:
        'Вас пригласили присоединиться к команде на geomarketing-platform.\n\n' +
        `Токен приглашения: ${token}\n\n` +
        'Используйте его для завершения регистрации через ' +
        'POST /team/invitations/accept.',
    });
  }
}

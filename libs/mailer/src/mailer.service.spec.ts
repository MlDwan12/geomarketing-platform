import { MailerNotConfiguredError, MailerService } from './mailer.service';

const sendMock = jest
  .fn()
  .mockResolvedValue({ data: { id: 'email-1' }, error: null });

jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: sendMock },
  })),
}));

describe('MailerService', () => {
  const originalKey = process.env.RESEND_API_KEY;

  afterEach(() => {
    process.env.RESEND_API_KEY = originalKey;
    sendMock.mockClear();
  });

  it('без RESEND_API_KEY — sendTeamInvite бросает MailerNotConfiguredError', async () => {
    delete process.env.RESEND_API_KEY;
    const mailer = new MailerService();
    mailer.onModuleInit();

    await expect(
      mailer.sendTeamInvite('a@example.com', 'token-1'),
    ).rejects.toThrow(MailerNotConfiguredError);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('с RESEND_API_KEY — sendTeamInvite отправляет письмо через Resend', async () => {
    process.env.RESEND_API_KEY = 're_test_key';
    const mailer = new MailerService();
    mailer.onModuleInit();

    await mailer.sendTeamInvite('a@example.com', 'token-1');

    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'a@example.com',
        from: 'onboarding@resend.dev',
      }),
    );
  });
});

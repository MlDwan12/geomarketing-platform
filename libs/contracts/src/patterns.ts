export const Patterns = {
  // Users / Auth
  USER_VALIDATE:          'user.validate',          // { email, password } → User | null
  USER_CREATE:            'user.create',             // { name, email, password, referralCode? } → User
  USER_GET_PROFILE:       'user.getProfile',         // { userId } → UserProfile
  USER_UPDATE_PROFILE:    'user.updateProfile',      // { userId, ...fields } → UserProfile
  USER_UPDATE_AVATAR:     'user.updateAvatar',       // { userId, avatarUrl } → { avatarUrl }
  USER_CHANGE_PASSWORD:   'user.changePassword',     // { userId, currentPassword, newPassword } → void | RpcException

  // Password reset
  PWD_RESET_CREATE:       'passwordReset.create',    // { email } → { token } | null
  PWD_RESET_CONSUME:      'passwordReset.consume',   // { token, newPassword } → void | RpcException

  // Brands
  BRAND_LIST:             'brand.list',
  BRAND_LIST_SHORT:       'brand.listShort',
  BRAND_GET:              'brand.get',
  BRAND_CREATE:           'brand.create',
  BRAND_UPDATE:           'brand.update',

  // Companies
  COMPANY_LIST:                    'company.list',
  COMPANY_GET:                     'company.get',
  COMPANY_CREATE:                  'company.create',
  COMPANY_GET_CARD:                'company.getCard',
  COMPANY_UPDATE_CARD:             'company.updateCard',
  COMPANY_FIND_BY_TWOGIS_ORG_ID:   'company.findByTwoGisOrgId',

  // Company groups
  GROUP_LIST:             'companyGroup.list',
  GROUP_CREATE:           'companyGroup.create',
  GROUP_UPDATE:           'companyGroup.update',
  GROUP_DELETE:           'companyGroup.delete',
  GROUP_MEMBER_REMOVE:    'companyGroup.removeMember',

  // Platforms
  PLATFORM_GET:           'platform.get',
  PLATFORM_CONNECT:       'platform.connect',
  PLATFORM_DISCONNECT:    'platform.disconnect',
  PLATFORM_SUMMARY:       'platform.summary',

  // Team
  TEAM_LIST_USERS:        'team.listUsers',
  TEAM_INVITE:            'team.invite',
  TEAM_INVITATION_LIST:   'team.invitationList',
  TEAM_INVITATION_REVOKE: 'team.invitationRevoke',

  // Billing
  BILLING_SUMMARY:        'billing.summary',

  // Referrals
  REFERRAL_LIST:          'referral.list',
} as const;

export type Pattern = (typeof Patterns)[keyof typeof Patterns];

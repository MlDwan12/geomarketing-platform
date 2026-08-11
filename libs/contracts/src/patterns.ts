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
  BRAND_DELETE:           'brand.delete',

  // Companies
  COMPANY_LIST:                    'company.list',
  COMPANY_LIST_FOR_VISIBILITY:     'company.listForVisibility',
  COMPANY_GET:                     'company.get',
  COMPANY_CREATE:                  'company.create',
  COMPANY_FIND_BY_TWOGIS_ORG_ID:   'company.findByTwoGisOrgId',
  COMPANY_DELETE:                  'company.delete',
  COMPANY_DEFAULT_UPDATE:          'company.default.update',
  COMPANY_PLATFORM_UPDATE:         'company.platform.update',
  COMPANY_PLATFORMS_GET:           'company.platforms.get',

  // Templates
  TEMPLATE_LIST:        'template.list',
  TEMPLATE_LIST_STATS:  'template.listStats',
  TEMPLATE_GET:         'template.get',
  TEMPLATE_CREATE:      'template.create',
  TEMPLATE_UPDATE:      'template.update',
  TEMPLATE_DELETE:      'template.delete',

  // Company groups
  GROUP_LIST:             'companyGroup.list',
  GROUP_LIST_STATS:       'companyGroup.listStats',
  GROUP_GET:              'companyGroup.get',
  GROUP_CREATE:           'companyGroup.create',
  GROUP_UPDATE:           'companyGroup.update',
  GROUP_DELETE:           'companyGroup.delete',
  GROUP_MEMBER_REMOVE:    'companyGroup.removeMember',
  GROUP_ADD_COMPANIES:    'companyGroup.addCompanies',
  GROUP_REMOVE_COMPANIES: 'companyGroup.removeCompanies',
  COMPANY_GROUPS_UPDATE:  'company.groups.update',
  COMPANY_MAIN_DATA_GET:    'company.mainData.get',

  // Platforms
  PLATFORM_GET:           'platform.get',
  PLATFORM_CONNECT:       'platform.connect',
  PLATFORM_DISCONNECT:    'platform.disconnect',
  PLATFORM_SUMMARY:       'platform.summary',

  // Team
  TEAM_LIST_USERS:          'team.listUsers',
  TEAM_INVITE:              'team.invite',
  TEAM_INVITATION_LIST:     'team.invitationList',
  TEAM_INVITATION_REVOKE:   'team.invitationRevoke',
  TEAM_MEMBER_UPDATE_ROLE:  'team.member.updateRole',
  TEAM_MEMBER_REMOVE:       'team.member.remove',
  TEAM_INVITATION_ACCEPT:   'team.invitation.accept',

  // Billing
  BILLING_SUMMARY:        'billing.summary',

  // Referrals
  REFERRAL_LIST:          'referral.list',

  // Integrations — 2GIS Places API (catalog.api.2gis.com/3.0/items)
  TWOGIS_PLACES_SEARCH: 'twogis.places.search', // { query, location?, regionId?, page?, pageSize? } → { items, total }

  // Integrations — Yandex Geosearch API (search-maps.yandex.ru/v1)
  YANDEX_PLACES_SEARCH: 'yandex.places.search', // { query, ll?, spn?, results?, skip? } → { items, total }

  // Integrations — объединённый поиск по 2ГИС + Яндекс с дедупликацией
  PLACES_SEARCH: 'places.search', // { query, location? } → { items, total, failedSources }

  // Integrations — проверка MapVisibility существующих Company на 2ГИС/Яндекс
  MAP_VISIBILITY_CHECK: 'mapVisibility.check', // { companies: CompanyRef[] } → MapVisibilityResult[]

  // CompetitorAnalysisReport — см. CONTEXT.md, docs/refactor-plans/competitor-analysis-report.md.
  // Коммит 1: только хранение/чтение истории, без бизнес-логики поиска конкурентов.
  COMPETITOR_ANALYSIS_SAVE: 'competitorAnalysis.save',
  COMPETITOR_ANALYSIS_GET_LATEST: 'competitorAnalysis.getLatest',
  COMPETITOR_ANALYSIS_LIST_HISTORY: 'competitorAnalysis.listHistory',

  // Integrations — поиск CompetitorListing для CompetitorAnalysisReport
  // (коммит 3 плана) — { company: CompanyRef } → CompetitorListing[]
  COMPETITOR_LISTINGS_FIND: 'competitorListings.find',

  // AI — сравнение с конкурентами (коммит 5 плана). cardComparison/
  // ratingComparison — детерминированные, textAnalysis — заглушка (null),
  // реальный вызов Claude API не подключён (см. Out of Scope плана).
  AI_COMPETITOR_ANALYSIS_GENERATE: 'ai.competitorAnalysis.generate',

  // review-service — см. docs/refactor-plans/review-service-own-reviews.md.
  // Коммит 4: скрапинг+сохранение отзывов одной компании на подключённых
  // платформах (2ГИС/Яндекс), партиальный успех на уровне платформы.
  REVIEW_REFRESH_COMPANY: 'review.refreshCompany',
  // Коммит 5: чтение уже сохранённых отзывов + агрегаты (total/unanswered/
  // averageRating, отдельно по источнику и суммарно). Не триггерит скрапинг.
  REVIEW_LIST_FOR_COMPANY: 'review.listForCompany',
  // Коммит 6: read-only дашборд на весь бренд — агрегаты по каждой компании
  // + сумма неотвеченных по всей сети. Не триггерит скрапинг (см. коммит 4
  // для обновления одной компании).
  REVIEW_BRAND_DASHBOARD: 'review.brandDashboard',
} as const;

export type Pattern = (typeof Patterns)[keyof typeof Patterns];

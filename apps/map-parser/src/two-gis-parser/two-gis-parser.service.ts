import { Injectable, Logger } from '@nestjs/common';
import { chromium, Browser, Page, Response } from 'playwright';

export type TwoGisReview = {
  externalId: string | null;
  authorName: string | null;
  authorAvatarUrl: string | null;
  publishedAt: string | null;
  dateText: string | null;
  text: string | null;
  stars: number | null;
  answer: string | null;
  answerPublishedAt: string | null;
  likesCount: number | null;
  provider: string | null;
  isHidden: boolean | null;
  isRated: boolean | null;
  hidingReason: string | null;
  source: 'api';
};

export type TwoGisParserResult = {
  companyId: string;
  twoGisUrl: string;
  branchId?: string;
  apiKey?: string;
  branchRating: number | null;
  branchReviewsCount: number | null;
  totalCount: number | null;
  parsed: number;
  reviews: TwoGisReview[];
  error?: string;
};

type ParseReviewsParams = {
  companyId: string;
  twoGisUrl: string;
  branchId?: string;
  limit?: number;
  saveToDb?: boolean;
};

type CapturedReviewsRequest = {
  url: string;
  apiKey: string;
  branchId: string;
};

@Injectable()
export class TwoGisParserService {
  private readonly logger = new Logger(TwoGisParserService.name);

  private readonly apiBaseUrl = 'https://public-api.reviews.2gis.com/3.0';

  async parseReviews(params: ParseReviewsParams): Promise<TwoGisParserResult> {
    const startedAt = Date.now();

    let browser: Browser | null = null;

    const initialBranchId =
      params.branchId ?? this.extractBranchId(params.twoGisUrl);

    try {
      this.logger.log('========================================');
      this.logger.log('START 2GIS PLAYWRIGHT + API PARSING');
      this.logger.log(`Company ID: ${params.companyId}`);
      this.logger.log(`URL: ${params.twoGisUrl}`);
      this.logger.log(
        `Initial branch ID: ${initialBranchId ?? 'not provided'}`,
      );
      this.logger.log(`Limit: ${params.limit ?? 'all'}`);

      browser = await chromium.launch({
        headless: true,

        channel: 'chrome',

        args: [
          '--start-maximized',
          '--disable-blink-features=AutomationControlled',
          '--disable-dev-shm-usage',
          '--no-sandbox',
          '--disable-setuid-sandbox',
        ],
      });

      const context = await browser.newContext({
        viewport: null,

        locale: 'ru-RU',

        userAgent:
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',

        extraHTTPHeaders: {
          'accept-language': 'ru-RU,ru;q=0.9,en;q=0.8',
        },
      });

      const page = await context.newPage();
      await page.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', {
          get: () => false,
        });

        // @ts-ignore
        window.chrome = {
          runtime: {},
        };

        Object.defineProperty(navigator, 'plugins', {
          get: () => [1, 2, 3, 4, 5],
        });

        Object.defineProperty(navigator, 'languages', {
          get: () => ['ru-RU', 'ru'],
        });
      });
      const captured = await this.openCardAndCaptureReviewsRequest(
        page,
        params.twoGisUrl,
        initialBranchId,
      );

      if (!captured) {
        throw new Error(
          '2GIS reviews API request was not captured from Network',
        );
      }

      this.logger.log(`Captured branch ID: ${captured.branchId}`);
      this.logger.log(`Captured API key: ${captured.apiKey}`);

      const apiResult = await this.loadAllReviewsFromApi({
        branchId: captured.branchId,
        apiKey: captured.apiKey,
        referer: params.twoGisUrl,
        limit: params.limit,
      });

      const duration = Date.now() - startedAt;

      this.logger.log(`2GIS parsed reviews: ${apiResult.reviews.length}`);
      this.logger.log(
        `2GIS branch reviews count: ${apiResult.branchReviewsCount ?? 'unknown'}`,
      );
      this.logger.log(
        `2GIS API total count: ${apiResult.totalCount ?? 'unknown'}`,
      );
      this.logger.log(`Duration: ${duration}ms`);
      this.logger.log('END 2GIS PLAYWRIGHT + API PARSING');
      this.logger.log('========================================');

      return {
        companyId: params.companyId,
        twoGisUrl: params.twoGisUrl,
        branchId: captured.branchId,
        apiKey: captured.apiKey,
        branchRating: apiResult.branchRating,
        branchReviewsCount: apiResult.branchReviewsCount,
        totalCount: apiResult.totalCount,
        parsed: apiResult.reviews.length,
        reviews: apiResult.reviews,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      this.logger.error(`2GIS parser failed: ${message}`);

      return {
        companyId: params.companyId,
        twoGisUrl: params.twoGisUrl,
        branchId: initialBranchId,
        branchRating: null,
        branchReviewsCount: null,
        totalCount: null,
        parsed: 0,
        reviews: [],
        error: message,
      };
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  private async openCardAndCaptureReviewsRequest(
    page: Page,
    twoGisUrl: string,
    fallbackBranchId?: string,
  ): Promise<CapturedReviewsRequest | null> {
    let captured: CapturedReviewsRequest | null = null;

    page.on('response', async (response: Response) => {
      try {
        const url = response.url();

        if (!this.isReviewsApiUrl(url)) {
          return;
        }

        const parsed = this.parseCapturedReviewsUrl(url);

        if (!parsed.apiKey || !parsed.branchId) {
          return;
        }

        captured = {
          url,
          apiKey: parsed.apiKey,
          branchId: parsed.branchId,
        };

        this.logger.log(`Captured reviews API URL: ${url}`);
      } catch {
        // ignore
      }
    });

    await page.goto(twoGisUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });

    await this.waitSafe(page, 5000);

    await this.openReviewsTabIfNeeded(page);

    for (let i = 1; i <= 8 && !captured; i++) {
      this.logger.log(`Waiting reviews API request, attempt ${i}/8`);

      await page.mouse.wheel(0, 1200);
      await this.waitSafe(page, 1500);
    }

    if (captured) {
      return captured;
    }

    if (fallbackBranchId) {
      const key = await this.extractApiKeyFromPage(page);

      if (key) {
        return {
          url: '',
          apiKey: key,
          branchId: fallbackBranchId,
        };
      }
    }

    return null;
  }

  private async openReviewsTabIfNeeded(page: Page): Promise<void> {
    const selectors = [
      'text=Отзывы',
      'button:has-text("Отзывы")',
      'a:has-text("Отзывы")',
      '[role="tab"]:has-text("Отзывы")',
      'a[href*="reviews"]',
      'a[href*="tab/reviews"]',
    ];

    for (const selector of selectors) {
      try {
        const element = page.locator(selector).first();

        if (await element.isVisible({ timeout: 2000 })) {
          this.logger.log(`Opening reviews tab by selector: ${selector}`);
          await element.click({ timeout: 5000 });
          await this.waitSafe(page, 4000);
          return;
        }
      } catch {
        // ignore
      }
    }

    this.logger.warn(
      'Reviews tab button not found, continue with current page',
    );
  }

  private async loadAllReviewsFromApi(params: {
    branchId: string;
    apiKey: string;
    referer: string;
    limit?: number;
  }): Promise<{
    branchRating: number | null;
    branchReviewsCount: number | null;
    totalCount: number | null;
    reviews: TwoGisReview[];
  }> {
    const allReviews: TwoGisReview[] = [];

    let branchRating: number | null = null;
    let branchReviewsCount: number | null = null;
    let maxTotalCount: number | null = null;

    const limitPerRequest = 50;

    const ratedVariants = ['false', 'true'];
    const sortVariants = ['friends'];

    for (const rated of ratedVariants) {
      for (const sortBy of sortVariants) {
        let offset = 0;
        let currentTotal: number | null = null;

        this.logger.log(`2GIS pass started: rated=${rated}, sort_by=${sortBy}`);

        while (true) {
          const apiUrl = this.buildReviewsApiUrl({
            branchId: params.branchId,
            apiKey: params.apiKey,
            limit: limitPerRequest,
            offset,
            rated,
            sortBy,
          });

          const response = await fetch(apiUrl, {
            method: 'GET',
            headers: this.getHeaders(params.referer),
          });

          if (!response.ok) {
            const text = await response.text();

            this.logger.warn(
              `2GIS API warning: ${response.status} ${response.statusText}. ${text}`,
            );

            break;
          }

          const json = await response.json();

          branchRating =
            this.toNumberOrNull(json?.meta?.branch_rating) ?? branchRating;
          branchReviewsCount =
            this.toNumberOrNull(json?.meta?.branch_reviews_count) ??
            branchReviewsCount;

          currentTotal =
            this.toNumberOrNull(json?.meta?.total_count) ?? currentTotal;
          maxTotalCount = Math.max(maxTotalCount ?? 0, currentTotal ?? 0);

          const pageReviews = this.normalizeReviews(json);

          this.logger.log(
            `2GIS page: rated=${rated}, sort_by=${sortBy}, offset=${offset}, received=${pageReviews.length}, total=${currentTotal ?? 'unknown'}`,
          );

          if (!pageReviews.length) {
            break;
          }

          allReviews.push(...pageReviews);

          const unique = this.uniqueReviews(allReviews);

          if (params.limit && unique.length >= params.limit) {
            return {
              branchRating,
              branchReviewsCount,
              totalCount: maxTotalCount,
              reviews: unique.slice(0, params.limit),
            };
          }

          offset += limitPerRequest;

          if (currentTotal !== null && offset >= currentTotal) {
            break;
          }

          await this.sleep(350);
        }
      }
    }

    return {
      branchRating,
      branchReviewsCount,
      totalCount: maxTotalCount,
      reviews: this.uniqueReviews(allReviews),
    };
  }

  private buildReviewsApiUrl(params: {
    branchId: string;
    apiKey: string;
    limit: number;
    offset: number;
    rated: string;
    sortBy: string;
  }): string {
    const url = new URL(
      `${this.apiBaseUrl}/branches/${params.branchId}/reviews`,
    );

    url.searchParams.set('limit', String(params.limit));
    url.searchParams.set('offset', String(params.offset));
    url.searchParams.set('is_advertiser', 'false');

    url.searchParams.set(
      'fields',
      [
        'meta.providers',
        'meta.branch_rating',
        'meta.branch_reviews_count',
        'meta.total_count',
        'reviews.hiding_reason',
        'reviews.emojis',
        'reviews.trust_factors',
      ].join(','),
    );

    url.searchParams.set('rated', params.rated);
    url.searchParams.set('sort_by', params.sortBy);
    url.searchParams.set('key', params.apiKey);
    url.searchParams.set('locale', 'ru_RU');

    return url.toString();
  }
  private normalizeReviews(json: any): TwoGisReview[] {
    const rawReviews = json?.reviews ?? [];

    if (!Array.isArray(rawReviews)) {
      return [];
    }

    return rawReviews
      .map((review: any): TwoGisReview => {
        const user = review.user ?? null;
        const answer = review.official_answer ?? null;

        return {
          externalId: review.id?.toString() ?? null,

          authorName: user?.name ?? user?.first_name ?? null,

          authorAvatarUrl:
            user?.photo_preview_urls?.url ??
            user?.photo_preview_urls?.['640x'] ??
            user?.photo_preview_urls?.['320x'] ??
            user?.photo_preview_urls?.['64x64'] ??
            null,

          publishedAt: review.date_created ?? null,

          dateText: review.date_created ?? null,

          text: review.text ?? null,

          stars: this.toNumberOrNull(review.rating),

          answer: answer?.text ?? null,

          answerPublishedAt: answer?.date_created ?? null,

          likesCount: this.toNumberOrNull(review.likes_count),

          provider: review.provider ?? user?.provider ?? null,

          isHidden:
            typeof review.is_hidden === 'boolean' ? review.is_hidden : null,

          isRated:
            typeof review.is_rated === 'boolean' ? review.is_rated : null,

          hidingReason: review.hiding_reason ?? null,

          source: 'api',
        };
      })
      .filter((review) => {
        return Boolean(
          review.externalId || review.text || review.authorName || review.stars,
        );
      });
  }

  private isReviewsApiUrl(url: string): boolean {
    return (
      url.includes('public-api.reviews.2gis.com') &&
      url.includes('/reviews') &&
      url.includes('/branches/')
    );
  }

  private parseCapturedReviewsUrl(url: string): {
    apiKey: string | null;
    branchId: string | null;
  } {
    try {
      const parsedUrl = new URL(url);

      const apiKey = parsedUrl.searchParams.get('key');

      const branchId =
        parsedUrl.pathname.match(/branches\/(\d+)\/reviews/)?.[1] ?? null;

      return {
        apiKey,
        branchId,
      };
    } catch {
      return {
        apiKey: null,
        branchId: null,
      };
    }
  }

  private async extractApiKeyFromPage(page: Page): Promise<string | null> {
    try {
      const html = await page.content();

      const keyMatch = html.match(
        /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i,
      );

      return keyMatch?.[0] ?? null;
    } catch {
      return null;
    }
  }

  private uniqueReviews(reviews: TwoGisReview[]): TwoGisReview[] {
    const map = new Map<string, TwoGisReview>();

    for (const review of reviews) {
      const key =
        review.externalId ??
        `${review.authorName ?? ''}-${review.publishedAt ?? ''}-${review.text ?? ''}`;

      if (!map.has(key)) {
        map.set(key, review);
      }
    }

    return Array.from(map.values());
  }

  private extractBranchId(url?: string): string | undefined {
    if (!url) return undefined;

    const patterns = [
      /firm\/(\d+)/,
      /branches\/(\d+)/,
      /geo\/(\d+)/,
      /\/(\d{6,})/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);

      if (match?.[1]) {
        return match[1];
      }
    }

    return undefined;
  }

  private getHeaders(referer: string): Record<string, string> {
    return {
      Accept: 'application/json, text/plain, */*',
      'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.8',
      Origin: 'https://2gis.ru',
      Referer: referer,
      'User-Agent':
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    };
  }

  private toNumberOrNull(value: unknown): number | null {
    if (value === null || value === undefined) return null;

    const number = Number(value);

    return Number.isFinite(number) ? number : null;
  }

  private async waitSafe(page: Page, ms: number): Promise<void> {
    await page.waitForTimeout(ms);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

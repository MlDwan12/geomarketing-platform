import { Injectable, Logger } from '@nestjs/common';
import { chromium, Browser, BrowserContext, Page, Route } from 'playwright';
import * as fs from 'node:fs/promises';

export type YandexCompanyInfo = {
  name: string | null;
  rating: number;
  ratingsCount: number;
  reviewsCount: number;
  stars: number;
};

export type YandexCompanyReview = {
  externalId: string | null;
  businessId: string | null;
  authorName: string | null;
  authorPublicId: string | null;
  authorAvatarUrl: string | null;
  authorProfessionLevel: string | null;
  publishedAt: number | null;
  text: string | null;
  textLanguage: string | null;
  stars: number;
  likes: number;
  dislikes: number;
  answer: string | null;
  answerPublishedAt: number | null;
  photos: string[];
  videos: string[];
  source: 'api';
};

export type YandexParserResult = {
  companyId: string;
  orgId: string;
  yandexUrl: string;
  companyInfo?: YandexCompanyInfo;
  reviews?: YandexCompanyReview[];
  totalReviewsCount?: number;
  collectedReviewsCount?: number;
  savedFetchReviewsResponsesCount?: number;
  initialHtmlReviewsCount?: number;
  debugHtmlPath?: string;
  error?: string;
};

export type ParseReviewsParams = {
  companyId: string;
  orgId: string | number;
  limit?: number;
  saveToDb?: boolean;
};

type FetchReviewsResponse = {
  data?: {
    reviews?: YandexApiReview[];
    params?: {
      count?: number;
    };
  };
  error?: {
    code?: number;
    message?: string;
  };
};

type SavedFetchReviewsResponse = {
  url: string;
  status: number;
  json: FetchReviewsResponse;
};

type InitialReviewResults = {
  reviews?: YandexApiReview[];
  params?: {
    count?: number;
  };
};

type YandexSearchResponse = {
  data?: {
    items?: YandexSearchBusinessItem[];
  };
};

type YandexSearchBusinessItem = {
  type?: string;
  id?: string;
  uri?: string;
  title?: string;
  ratingData?: {
    ratingCount?: number;
    ratingValue?: number;
    reviewCount?: number;
  };
  subtitleItems?: Array<{
    type?: string;
    text?: string;
    property?: Array<{
      key?: string;
      value?: string;
    }>;
  }>;
};

type YandexApiReview = {
  reviewId?: string;
  businessId?: string;
  author?: {
    name?: string;
    avatarUrl?: string;
    publicId?: string;
    professionLevel?: string;
  };
  text?: string;
  textLanguage?: string;
  rating?: number;
  updatedTime?: string;
  reactions?: {
    likes?: number;
    dislikes?: number;
  };
  businessComment?: {
    text?: string;
    updatedTime?: string;
  };
  photos?: Array<{
    urlTemplate?: string;
    url?: string;
  }>;
  videos?: Array<{
    urlTemplate?: string;
    url?: string;
  }>;
};

@Injectable()
export class YandexParserService {
  private readonly logger = new Logger(YandexParserService.name);

  async parseReviews(params: ParseReviewsParams): Promise<YandexParserResult> {
    const startedAt = Date.now();
    const orgId = this.cleanOrgId(params.orgId);

    if (!orgId) {
      return {
        companyId: params.companyId,
        orgId: String(params.orgId ?? ''),
        yandexUrl: '',
        error: 'Некорректный orgId',
      };
    }

    const yandexUrl = this.buildOrgUrl(orgId);
    const debugHtmlPath = `./debug/yandex_${orgId}.html`;

    const limit =
      params.limit && params.limit > 0 ? params.limit : Number.MAX_SAFE_INTEGER;

    let browser: Browser | undefined;
    let context: BrowserContext | undefined;
    let page: Page | undefined;

    const reviewsMap = new Map<string, YandexCompanyReview>();
    const savedFetchReviewsResponses: SavedFetchReviewsResponse[] = [];

    let totalReviewsCount: number | null = null;
    let companyInfoFromApi: YandexCompanyInfo | null = null;
    let initialHtmlReviewsCount = 0;

    try {
      browser = await chromium.launch({
        headless: false,
        args: [
          '--no-sandbox',
          '--disable-dev-shm-usage',
          '--disable-blink-features=AutomationControlled',
          '--disable-cache',
        ],
      });

      context = await browser.newContext({
        serviceWorkers: 'block',
        bypassCSP: true,
        locale: 'ru-RU',
        timezoneId: 'Europe/Moscow',
        viewport: { width: 1440, height: 900 },
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        extraHTTPHeaders: {
          'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.8',
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache',
        },
      });

      await context.clearCookies();

      await context.route(
        '**/maps/api/business/fetchReviews**',
        async (route) => {
          await this.handleFetchReviewsRoute(route, savedFetchReviewsResponses);
        },
      );

      page = await context.newPage();

      page.on('response', (response) => {
        const url = response.url();

        if (!url.includes('/maps/api/search')) return;

        const bodyPromise = response.text().catch(() => null);

        void this.handleCompanySearchResponseWithBody(
          bodyPromise,
          orgId,
          (info) => {
            companyInfoFromApi = info;
          },
        );
      });

      const targetUrl = this.buildReviewsUrl(orgId);
      this.logger.log(`Opening: ${targetUrl}`);

      await page.goto(targetUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 60_000,
      });

      await page.waitForTimeout(5000);

      const html = await this.saveDebugHtml(page, orgId, debugHtmlPath);

      const initialTotalCount = this.collectInitialReviewsFromHtml(
        html,
        reviewsMap,
      );

      initialHtmlReviewsCount = reviewsMap.size;

      if (typeof initialTotalCount === 'number') {
        totalReviewsCount = initialTotalCount;
      }

      this.logger.log(
        `Initial HTML reviews collected: ${initialHtmlReviewsCount}/${totalReviewsCount ?? '?'}`,
      );

      if (await this.checkCaptcha(page)) {
        await page.screenshot({
          path: `./debug/captcha_${orgId}.png`,
          fullPage: true,
        });

        return {
          companyId: params.companyId,
          yandexUrl,
          orgId,
          debugHtmlPath,
          error: `Обнаружена капча. Скриншот: ./debug/captcha_${orgId}.png`,
        };
      }

      const companyInfo =
        companyInfoFromApi ?? (await this.getCompanyInfo(page));

      await this.scrollUntilNetworkQuiet(
        page,
        () => savedFetchReviewsResponses.length,
      );

      const networkTotalCount = this.collectReviewsFromSavedResponses(
        savedFetchReviewsResponses,
        reviewsMap,
      );

      if (typeof networkTotalCount === 'number') {
        totalReviewsCount = networkTotalCount;
      }

      const reviews = [...reviewsMap.values()].slice(0, limit);

      this.logger.log(
        `Done in ${Date.now() - startedAt}ms. Reviews collected: ${
          reviews.length
        }/${totalReviewsCount ?? companyInfo.reviewsCount ?? '?'}. Initial HTML: ${initialHtmlReviewsCount}. Saved fetchReviews responses: ${
          savedFetchReviewsResponses.length
        }`,
      );

      return {
        companyId: params.companyId,
        yandexUrl,
        orgId,
        companyInfo: {
          ...companyInfo,
          reviewsCount: totalReviewsCount ?? companyInfo.reviewsCount,
        },
        reviews,
        totalReviewsCount:
          totalReviewsCount ?? companyInfo.reviewsCount ?? reviews.length,
        collectedReviewsCount: reviews.length,
        savedFetchReviewsResponsesCount: savedFetchReviewsResponses.length,
        initialHtmlReviewsCount,
        debugHtmlPath,
      };
    } catch (error) {
      if (page) {
        await page
          .screenshot({
            path: `./debug/error_${orgId}_${Date.now()}.png`,
            fullPage: true,
          })
          .catch(() => undefined);
      }

      return {
        companyId: params.companyId,
        yandexUrl,
        orgId,
        debugHtmlPath,
        error: error instanceof Error ? error.message : String(error),
      };
    } finally {
      await page?.close().catch(() => undefined);
      await context?.close().catch(() => undefined);
      await browser?.close().catch(() => undefined);
    }
  }

  private collectInitialReviewsFromHtml(
    html: string,
    reviewsMap: Map<string, YandexCompanyReview>,
  ): number | null {
    const marker = '"reviewResults":';

    const markerIndex = html.indexOf(marker);

    if (markerIndex === -1) {
      this.logger.warn('Initial HTML reviewResults not found');
      return null;
    }

    const objectStart = html.indexOf('{', markerIndex + marker.length);

    if (objectStart === -1) {
      this.logger.warn('Initial HTML reviewResults object start not found');
      return null;
    }

    const objectEnd = this.findJsonObjectEnd(html, objectStart);

    if (objectEnd === -1) {
      this.logger.warn('Initial HTML reviewResults object end not found');
      return null;
    }

    const jsonText = this.unescapeHtmlJson(
      html.slice(objectStart, objectEnd + 1),
    );

    try {
      const reviewResults = JSON.parse(jsonText) as InitialReviewResults;
      const apiReviews = reviewResults.reviews ?? [];
      const before = reviewsMap.size;

      for (const apiReview of apiReviews) {
        const review = this.mapApiReview(apiReview);

        if (!review.externalId && !review.authorPublicId) {
          continue;
        }

        reviewsMap.set(this.getReviewKey(review), review);
      }

      const added = reviewsMap.size - before;
      const totalCount =
        typeof reviewResults.params?.count === 'number'
          ? reviewResults.params.count
          : null;

      this.logger.log(
        [
          `Initial HTML reviewResults collected`,
          `got=${apiReviews.length}`,
          `added=${added}`,
          `totalUnique=${reviewsMap.size}`,
          `apiTotal=${totalCount ?? '?'}`,
        ].join(' | '),
      );

      return totalCount;
    } catch (error) {
      this.logger.warn(
        `Failed to parse initial reviewResults JSON: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );

      return null;
    }
  }

  private findJsonObjectEnd(text: string, startIndex: number): number {
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let i = startIndex; i < text.length; i++) {
      const char = text[i];

      if (inString) {
        if (escaped) {
          escaped = false;
          continue;
        }

        if (char === '\\') {
          escaped = true;
          continue;
        }

        if (char === '"') {
          inString = false;
        }

        continue;
      }

      if (char === '"') {
        inString = true;
        continue;
      }

      if (char === '{') {
        depth++;
        continue;
      }

      if (char === '}') {
        depth--;

        if (depth === 0) {
          return i;
        }
      }
    }

    return -1;
  }

  private unescapeHtmlJson(value: string): string {
    return value
      .replace(/&quot;/g, '"')
      .replace(/&#34;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');
  }

  private async saveDebugHtml(
    page: Page,
    orgId: string,
    path: string,
  ): Promise<string> {
    await fs.mkdir('./debug', { recursive: true });

    const html = await page.content();

    await fs.writeFile(path, html, 'utf8');

    this.logger.log(`HTML saved: ${path}`);
    this.logger.log(
      `HTML contains reviewResults: ${html.includes('reviewResults')}`,
    );
    this.logger.log(`HTML contains reviewId: ${html.includes('reviewId')}`);
    this.logger.log(
      `HTML contains businessComment: ${html.includes('businessComment')}`,
    );
    this.logger.log(
      `Run: grep -n "reviewResults" ./debug/yandex_${orgId}.html | head`,
    );

    return html;
  }

  private async handleFetchReviewsRoute(
    route: Route,
    savedResponses: SavedFetchReviewsResponse[],
  ): Promise<void> {
    const url = route.request().url();

    this.logger.log(
      [
        `fetchReviews REQUEST`,
        `page=${this.getQueryParam(url, 'page') ?? 'unknown'}`,
        `ranking=${this.getQueryParam(url, 'ranking') ?? 'unknown'}`,
      ].join(' | '),
    );

    try {
      const response = await route.fetch();
      const body = await response.text();

      await route.fulfill({
        response,
        body,
      });

      this.saveFetchReviewsBody(url, response.status(), body, savedResponses);
    } catch (error) {
      this.logger.warn(
        `fetchReviews route failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );

      await route.continue().catch(() => undefined);
    }
  }

  private saveFetchReviewsBody(
    url: string,
    status: number,
    body: string,
    savedResponses: SavedFetchReviewsResponse[],
  ): void {
    if (savedResponses.some((item) => item.url === url)) {
      return;
    }

    const page = this.getQueryParam(url, 'page') ?? 'unknown';
    const ranking = this.getQueryParam(url, 'ranking') ?? 'unknown';

    try {
      const json = JSON.parse(body) as FetchReviewsResponse;

      savedResponses.push({
        url,
        status,
        json,
      });

      this.logger.log(
        [
          `fetchReviews saved`,
          `ranking=${ranking}`,
          `page=${page}`,
          `got=${json.data?.reviews?.length ?? 0}`,
          `apiTotal=${json.data?.params?.count ?? '?'}`,
          `saved=${savedResponses.length}`,
          `status=${status}`,
        ].join(' | '),
      );

      if (json.error) {
        this.logger.warn(
          `fetchReviews saved with error | page=${page} | error=${JSON.stringify(
            json.error,
          ).slice(0, 1000)}`,
        );
      }
    } catch (error) {
      this.logger.warn(
        [
          `Failed to parse fetchReviews JSON`,
          `ranking=${ranking}`,
          `page=${page}`,
          `status=${status}`,
          `error=${error instanceof Error ? error.message : String(error)}`,
        ].join(' | '),
      );
    }
  }

  private async handleCompanySearchResponseWithBody(
    bodyPromise: Promise<string | null>,
    orgId: string,
    setCompanyInfo: (info: YandexCompanyInfo) => void,
  ): Promise<void> {
    try {
      const body = await bodyPromise;
      if (!body) return;

      const json = JSON.parse(body) as YandexSearchResponse;
      const items = json.data?.items ?? [];

      const business = items.find((item) => {
        if (item.type !== 'business') return false;

        return item.id === orgId || item.uri?.includes(`oid=${orgId}`);
      });

      if (!business) return;

      const rating =
        this.roundRating(business.ratingData?.ratingValue) ||
        this.getRatingFromSubtitleItems(business.subtitleItems);

      const info: YandexCompanyInfo = {
        name: this.cleanString(business.title),
        rating,
        ratingsCount: business.ratingData?.ratingCount ?? 0,
        reviewsCount: business.ratingData?.reviewCount ?? 0,
        stars: Math.round(rating),
      };

      setCompanyInfo(info);

      this.logger.log(
        [
          `Company info intercepted`,
          `targetOrgId=${orgId}`,
          `matchedOrgId=${business.id ?? 'unknown'}`,
          `name=${info.name}`,
          `rating=${info.rating}`,
          `ratingsCount=${info.ratingsCount}`,
          `reviewsCount=${info.reviewsCount}`,
        ].join(' | '),
      );
    } catch (error) {
      this.logger.warn(
        `Failed to parse company search response: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private async scrollUntilNetworkQuiet(
    page: Page,
    getSavedCount: () => number,
  ): Promise<void> {
    let previousSavedCount = getSavedCount();
    let stuckIterations = 0;

    for (let i = 0; i < 80; i++) {
      await this.progressiveScrollReviews(page);
      await page.waitForTimeout(1200);

      const currentSavedCount = getSavedCount();

      this.logger.log(
        `Scroll network progress: iteration=${
          i + 1
        }, savedFetchReviews=${currentSavedCount}`,
      );

      if (currentSavedCount === previousSavedCount) {
        stuckIterations++;
      } else {
        stuckIterations = 0;
        previousSavedCount = currentSavedCount;
      }

      if (stuckIterations >= 5) {
        this.logger.warn(
          `Scroll stopped: no new fetchReviews responses after ${stuckIterations} iterations`,
        );
        break;
      }
    }
  }

  private collectReviewsFromSavedResponses(
    responses: SavedFetchReviewsResponse[],
    reviewsMap: Map<string, YandexCompanyReview>,
  ): number | null {
    let totalCount: number | null = null;

    const sortedResponses = [...responses].sort((a, b) => {
      const pageA = Number(this.getQueryParam(a.url, 'page') ?? 0);
      const pageB = Number(this.getQueryParam(b.url, 'page') ?? 0);

      return pageA - pageB;
    });

    for (const response of sortedResponses) {
      const page = this.getQueryParam(response.url, 'page') ?? 'unknown';
      const ranking = this.getQueryParam(response.url, 'ranking') ?? 'unknown';

      if (response.json.error) {
        this.logger.warn(
          `fetchReviews skipped error response | ranking=${ranking} | page=${page} | error=${JSON.stringify(
            response.json.error,
          ).slice(0, 1000)}`,
        );
        continue;
      }

      const apiReviews = response.json.data?.reviews ?? [];
      const count = response.json.data?.params?.count;

      if (typeof count === 'number') {
        totalCount = count;
      }

      const before = reviewsMap.size;

      for (const apiReview of apiReviews) {
        const review = this.mapApiReview(apiReview);

        if (!review.externalId && !review.authorPublicId) {
          continue;
        }

        reviewsMap.set(this.getReviewKey(review), review);
      }

      this.logger.log(
        [
          `fetchReviews collected`,
          `ranking=${ranking}`,
          `page=${page}`,
          `got=${apiReviews.length}`,
          `added=${reviewsMap.size - before}`,
          `totalUnique=${reviewsMap.size}`,
          `apiTotal=${totalCount ?? '?'}`,
        ].join(' | '),
      );
    }

    return totalCount;
  }

  private async progressiveScrollReviews(page: Page): Promise<void> {
    await page.evaluate(async () => {
      const sleep = (ms: number) =>
        new Promise((resolve) => setTimeout(resolve, ms));

      const elements = Array.from(document.querySelectorAll('*')).filter(
        (el): el is HTMLElement => el instanceof HTMLElement,
      );

      const candidates = elements
        .filter((el) => {
          const style = window.getComputedStyle(el);

          return (
            ['auto', 'scroll'].includes(style.overflowY) &&
            el.scrollHeight > el.clientHeight + 300
          );
        })
        .sort((a, b) => b.scrollHeight - a.scrollHeight);

      const target = candidates[0];

      if (!target) {
        window.scrollBy(0, 3000);
        return;
      }

      target.focus();

      for (let i = 0; i < 20; i++) {
        target.scrollTop += 900;

        target.dispatchEvent(
          new WheelEvent('wheel', {
            deltaY: 900,
            bubbles: true,
            cancelable: true,
          }),
        );

        target.dispatchEvent(new Event('scroll', { bubbles: true }));

        await sleep(180);
      }
    });

    for (let i = 0; i < 4; i++) {
      await page.mouse.wheel(0, 2500).catch(() => undefined);
      await page.keyboard.press('PageDown').catch(() => undefined);
      await page.waitForTimeout(200);
    }

    await page.waitForLoadState('networkidle').catch(() => undefined);
  }

  private mapApiReview(review: YandexApiReview): YandexCompanyReview {
    return {
      externalId: review.reviewId ?? null,
      businessId: review.businessId ?? null,
      authorName: this.cleanString(review.author?.name),
      authorPublicId: this.cleanString(review.author?.publicId),
      authorAvatarUrl: this.normalizeImageUrl(review.author?.avatarUrl),
      authorProfessionLevel: this.cleanString(review.author?.professionLevel),
      publishedAt: this.toUnixSeconds(review.updatedTime),
      text: this.cleanString(review.text),
      textLanguage: this.cleanString(review.textLanguage),
      stars: typeof review.rating === 'number' ? review.rating : 0,
      likes: review.reactions?.likes ?? 0,
      dislikes: review.reactions?.dislikes ?? 0,
      answer: this.cleanString(review.businessComment?.text),
      answerPublishedAt: this.toUnixSeconds(
        review.businessComment?.updatedTime,
      ),
      photos: (review.photos ?? [])
        .map((photo) => this.normalizeImageUrl(photo.urlTemplate ?? photo.url))
        .filter((url): url is string => Boolean(url)),
      videos: (review.videos ?? [])
        .map((video) => this.normalizeImageUrl(video.urlTemplate ?? video.url))
        .filter((url): url is string => Boolean(url)),
      source: 'api',
    };
  }

  private getReviewKey(review: YandexCompanyReview): string {
    return (
      review.externalId ||
      `${review.authorPublicId || review.authorName || 'unknown'}|${
        review.publishedAt || 'no-date'
      }|${review.stars}|${review.text?.slice(0, 40) || 'no-text'}`
    );
  }

  private buildOrgUrl(orgId: string): string {
    return `https://yandex.com/maps/org/org/${orgId}/`;
  }

  private buildReviewsUrl(orgId: string): string {
    return `https://yandex.com/maps/org/org/${orgId}/reviews/`;
  }

  private cleanOrgId(value: unknown): string | null {
    if (typeof value !== 'string' && typeof value !== 'number') {
      return null;
    }

    const clean = String(value).trim();

    return /^\d+$/.test(clean) ? clean : null;
  }

  private async checkCaptcha(page: Page): Promise<boolean> {
    const url = page.url().toLowerCase();

    if (url.includes('captcha') || url.includes('showcaptcha')) return true;

    const title = (await page.title().catch(() => '')).toLowerCase();
    if (title.includes('captcha')) return true;

    const bodyText = (
      (await page
        .locator('body')
        .first()
        .textContent()
        .catch(() => '')) ?? ''
    ).toLowerCase();

    return (
      bodyText.includes('подтвердите, что вы не робот') ||
      bodyText.includes('подтвердите, что запросы отправляли вы') ||
      bodyText.includes('smartcaptcha')
    );
  }

  private async getCompanyInfo(page: Page): Promise<YandexCompanyInfo> {
    return page.evaluate(() => {
      const getText = (selector: string): string | null =>
        document.querySelector(selector)?.textContent?.trim() || null;

      const parseNumber = (text?: string | null): number => {
        if (!text) return 0;

        const clean = text.replace(',', '.');
        const match = clean.match(/\d+(?:\.\d+)?/);

        return match ? Number(match[0]) : 0;
      };

      const parseCount = (text?: string | null): number => {
        if (!text) return 0;

        const clean = text.toLowerCase().replace(/\s/g, '');
        const match = clean.match(/(\d+(?:[.,]\d+)?)(тыс|млн|k|m)?/);

        if (!match) return 0;

        const number = Number(match[1].replace(',', '.'));

        if (match[2] === 'тыс' || match[2] === 'k') {
          return Math.round(number * 1000);
        }

        if (match[2] === 'млн' || match[2] === 'm') {
          return Math.round(number * 1_000_000);
        }

        return Math.round(number);
      };

      const bodyText = document.body.textContent || '';

      const name =
        getText('h1.orgpage-header-view__header') ||
        getText('h1[data-testid="org-header"]') ||
        getText('h1');

      const ratingText =
        getText('[data-testid="rating"]') ||
        getText('.business-rating-badge-view__rating-text') ||
        getText('[class*="business-rating-badge-view__rating-text"]') ||
        bodyText.match(/(\d[,.]\d)\s*\d[\d\s]*\s*оцен/i)?.[1] ||
        bodyText.match(/(\d[,.]\d)\s+\d[\d\s]*\s*отзыв/i)?.[1] ||
        null;

      const ratingsCountText =
        getText('.business-rating-amount-view') ||
        getText('[class*="business-rating-amount-view"]') ||
        bodyText.match(/\d[\d\s]*\s*оцен/i)?.[0] ||
        null;

      const reviewsText =
        bodyText.match(/\d[\d\s,.]*(?:тыс|млн)?\s*отзыв/i)?.[0] || null;

      const rating = parseNumber(ratingText);

      return {
        name,
        rating,
        ratingsCount: parseCount(ratingsCountText),
        reviewsCount: parseCount(reviewsText),
        stars: Math.round(rating),
      };
    });
  }

  private getRatingFromSubtitleItems(
    subtitleItems: YandexSearchBusinessItem['subtitleItems'],
  ): number {
    const ratingItem = subtitleItems?.find((item) => item.type === 'rating');

    const value5 = ratingItem?.property?.find(
      (property) => property.key === 'value_5',
    )?.value;

    const rating = Number(value5?.replace(',', '.'));

    if (!Number.isFinite(rating)) {
      return 0;
    }

    return Math.round(rating * 10) / 10;
  }

  private getQueryParam(url: string, name: string): string | null {
    try {
      return new URL(url).searchParams.get(name);
    } catch {
      return null;
    }
  }

  private cleanString(value: unknown): string | null {
    if (typeof value !== 'string') return null;

    const clean = value.replace(/\s+/g, ' ').trim();

    return clean || null;
  }

  private toUnixSeconds(value: unknown): number | null {
    if (!value) return null;

    if (typeof value === 'number' && Number.isFinite(value)) {
      return value > 1e10 ? Math.floor(value / 1000) : Math.floor(value);
    }

    if (typeof value === 'string') {
      const timestamp = Date.parse(value);
      if (!Number.isNaN(timestamp)) return Math.floor(timestamp / 1000);
    }

    return null;
  }

  private normalizeImageUrl(value: unknown): string | null {
    if (typeof value !== 'string') return null;

    const clean = value.trim();
    if (!clean) return null;

    return clean.replace('{size}', 'orig').replace('%s', 'orig');
  }

  private roundRating(value: unknown): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return 0;
    }

    return Math.round(value * 10) / 10;
  }
}

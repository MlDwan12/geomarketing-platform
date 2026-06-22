import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { chromium } from 'playwright';

type ContactAction = 'add' | 'edit' | 'delete' | 'change';

type TwoGisItem = {
  id: string;
  name?: string;
  type?: string;
  subtype?: string;
  address_name?: string;
  full_name?: string;
  org?: {
    id?: string;
    name?: string;
  };
  rubrics?: {
    id: string;
    name: string;
  }[];
};

type TwoGisItemsResponse = {
  result?: {
    items?: TwoGisItem[];
  };
};

export type ContactUpdate = {
  id?: string;
  type: 'phone' | 'email' | 'website' | 'vk' | 'instagram' | 'odnoklassniki';
  value: string;
  action: ContactAction;
};

export type UpdateBranchFields = Record<string, unknown>;

export type BranchUpdate = {
  fields?: UpdateBranchFields;
  contacts?: ContactUpdate[];
};

type BulkUpdateResult = {
  branchId: string;
  success: boolean;
  error?: string;
};

@Injectable()
export class TwoGisAccountService {
  private readonly logger = new Logger(TwoGisAccountService.name);
  private readonly apiBase = 'https://api.account.2gis.com/api/1.0';
  private readonly apiKey = 'accweb96f8';
  private readonly catalogApiBase = 'https://catalog.api.2gis.com';

  private cachedToken: string | null = null;
  private tokenExpiresAt = 0;

  constructor(private readonly config: ConfigService) {}

  async listOrgs(): Promise<unknown> {
    const token = await this.getToken();

    const res = await fetch(`${this.apiBase}/orgs`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'x-api-key': this.apiKey,
        locale: 'ru',
        origin: 'https://account.2gis.com',
        referer: 'https://account.2gis.com/',
      },
    });

    const text = await res.text();
    if (!res.ok) {
      throw new Error(`2GIS orgs list ${res.status}: ${text.slice(0, 300)}`);
    }
    return JSON.parse(text);
  }

  async listBranches(orgId: string, page = 1, perPage = 50): Promise<unknown> {
    const token = await this.getToken();

    const url = new URL(`${this.apiBase}/branches`);
    url.searchParams.set('orgId', orgId);
    url.searchParams.set('page', String(page));
    url.searchParams.set('per_page', String(perPage));

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        'x-api-key': this.apiKey,
        locale: 'ru',
        origin: 'https://account.2gis.com',
        referer: 'https://account.2gis.com/',
      },
    });

    const text = await res.text();
    if (!res.ok) {
      throw new Error(`2GIS branches list ${res.status}: ${text.slice(0, 300)}`);
    }
    return JSON.parse(text);
  }

  async getBranchInfo(branchId: string) {
    const url = new URL('https://catalog.api.2gis.com/3.0/items/byid');

    url.searchParams.set('id', branchId);
    url.searchParams.set(
      'key',
      this.config.getOrThrow<string>('TWO_GIS_API_KEY'),
    );
    url.searchParams.set('locale', 'ru_RU');
    url.searchParams.set(
      'fields',
      'items.adm_div,items.contact_groups,items.rubrics,items.schedule,items.reviews,items.point,items.description,items.photos,items.flags',
    );

    const res = await fetch(url);

    if (!res.ok) {
      throw new Error(`2GIS error ${res.status}`);
    }

    return res.json();
  }

  private async getBranchInfoFromDocs(
    branchId: string,
  ): Promise<TwoGisItem | null> {
    const url = new URL(`${this.catalogApiBase}/3.0/items/byid`);

    url.searchParams.set('id', branchId);
    url.searchParams.set('key', this.apiKey);
    url.searchParams.set('locale', 'ru_RU');
    url.searchParams.set(
      'fields',
      [
        'items.org',
        'items.rubrics',
        'items.address',
        'items.contact_groups',
      ].join(','),
    );

    const res = await fetch(url);

    const data = (await res.json()) as TwoGisItemsResponse;

    if (!res.ok) {
      throw new Error(
        `2GIS catalog ${res.status}: ${JSON.stringify(data).slice(0, 300)}`,
      );
    }

    return data.result?.items?.[0] ?? null;
  }

  private async searchRubrics(q: string, regionId: string): Promise<unknown> {
    const url = new URL(`${this.catalogApiBase}/2.0/catalog/rubric/search`);

    url.searchParams.set('q', q);
    url.searchParams.set('region_id', regionId);
    url.searchParams.set('key', this.apiKey);

    const res = await fetch(url);
    const data = await res.json();

    if (!res.ok) {
      throw new Error(
        `2GIS rubrics ${res.status}: ${JSON.stringify(data).slice(0, 300)}`,
      );
    }

    return data;
  }

  async updateBranch(branchId: string, update: BranchUpdate): Promise<unknown> {
    const token = await this.getToken();
    const results: unknown[] = [];

    if (update.fields && Object.keys(update.fields).length) {
      results.push(await this.putBranch(branchId, token, update.fields));
    }

    if (update.contacts?.length) {
      results.push(await this.putContacts(branchId, token, update.contacts));
    }

    return results.length === 1 ? results[0] : results;
  }

  async bulkUpdateBranches(
    branchIds: string[],
    update: BranchUpdate,
  ): Promise<BulkUpdateResult[]> {
    const token = await this.getToken();
    const results: BulkUpdateResult[] = [];

    for (const branchId of branchIds) {
      try {
        if (update.fields && Object.keys(update.fields).length) {
          await this.putBranch(branchId, token, update.fields);
        }
        if (update.contacts?.length) {
          await this.putContacts(branchId, token, update.contacts);
        }
        results.push({ branchId, success: true });
        this.logger.log(`Branch ${branchId} updated OK`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        results.push({ branchId, success: false, error: message });
        this.logger.error(`Branch ${branchId} failed: ${message}`);
      }
      await this.sleep(400);
    }

    return results;
  }

  private async putContacts(
    branchId: string,
    token: string,
    contacts: ContactUpdate[],
  ): Promise<unknown> {
    const res = await fetch(`${this.apiBase}/branches/${branchId}/contacts`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'x-api-key': this.apiKey,
        locale: 'ru',
        origin: 'https://account.2gis.com',
        referer: 'https://account.2gis.com/',
      },
      body: JSON.stringify({ contacts }),
    });

    const text = await res.text();
    if (!res.ok) {
      throw new Error(`2GIS contacts ${res.status}: ${text.slice(0, 300)}`);
    }
    return JSON.parse(text);
  }

  private async getToken(): Promise<string> {
    if (this.cachedToken && Date.now() < this.tokenExpiresAt) {
      return this.cachedToken;
    }

    const login = this.config.getOrThrow<string>('TWO_GIS_LOGIN');
    const password = this.config.getOrThrow<string>('TWO_GIS_PASSWORD');

    const res = await fetch(`${this.apiBase}/users/auth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        locale: 'ru',
        origin: 'https://account.2gis.com',
        referer: 'https://account.2gis.com/',
      },
      body: JSON.stringify({ login, password }),
    });

    const json = await res.json();

    if (!res.ok) {
      throw new Error(
        `2GIS auth failed ${res.status}: ${JSON.stringify(json).slice(0, 200)}`,
      );
    }

    const token = json?.result?.access_token;
    if (!token) {
      throw new Error('2GIS auth: no access_token in response');
    }

    this.cachedToken = token;
    this.tokenExpiresAt = Date.now() + 50 * 60 * 1000; // 50 минут

    this.logger.log('2GIS token refreshed');
    return token;
  }

  private async putBranch(
    branchId: string,
    token: string,
    fields: UpdateBranchFields,
  ): Promise<unknown> {
    const res = await fetch(`${this.apiBase}/branches/${branchId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'x-api-key': this.apiKey,
        locale: 'ru',
        origin: 'https://account.2gis.com',
        referer: 'https://account.2gis.com/',
      },
      body: JSON.stringify(fields),
    });

    const text = await res.text();

    if (!res.ok) {
      throw new Error(`2GIS ${res.status}: ${text.slice(0, 300)}`);
    }

    return JSON.parse(text);
  }

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async auth(login: string, password: string): Promise<unknown> {
    const browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    });

    try {
      const context = await browser.newContext();
      const page = await context.newPage();

      await page.goto('https://account.2gis.com/', {
        waitUntil: 'domcontentloaded',
        timeout: 30_000,
      });

      return await page.evaluate(
        async ({ apiBase, apiKey, login, password }) => {
          const res = await fetch(`${apiBase}/users/auth`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': apiKey,
              locale: 'ru',
            },
            body: JSON.stringify({ login, password }),
          });
          return res.json();
        },
        { apiBase: this.apiBase, apiKey: this.apiKey, login, password },
      );
    } finally {
      await browser.close();
    }
  }
}

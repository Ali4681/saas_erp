import { Injectable, Logger } from '@nestjs/common';
import type { CredentialPayload } from '../../effective-capability.service';
import {
  asArray,
  asRecord,
  money,
  resolveAccessToken,
} from './credential-resolve';
import {
  cookieHeader,
  providerFetch,
  ProviderHttpError,
} from './provider-http.client';
import { ExtensionBridgeService } from '../../extension/extension-bridge.service';

export const HS_GRAPHQL_URL =
  'https://vagw-api.eu.prd.portal.restaurant/query';
export const HS_BFF_LOGIN_URL =
  'https://bff-api.eu.prd.portal.restaurant/auth/v4/login';
export const HS_GLOBAL_ENTITY_ID = 'HS_SA';
export const HS_VENDOR_API_BASE =
  'https://vendor-api-sa.me.restaurant-partners.com/api/5/platforms/HS_SA/vendors';
/** Vendor translation / image service (partner portal). */
export const HS_IMAGES_API_BASE =
  'https://vts.eu.restaurant-partners.com/api/1/images';
export const HS_TRANSLATIONS_API_BASE =
  'https://vts.eu.restaurant-partners.com/api/1/translations';
/** Vendor ops / performance reports (OneWeb dashboard). */
export const HS_PERFORMANCE_REPORT_URL =
  'https://vos-api.eu.prd.portal.restaurant/v1/vendors/reports/performance';
/** Vendor store status / open-close (partner portal OneWeb). */
export const HS_VENDOR_STATUS_API_BASE =
  'https://vss.me.restaurant-partners.com/api/v1/globalEntities';

export type HsSalesGranularity = 'HOUR' | 'DAY' | 'MONTH';
export type HsStoreAvailability = 'OPEN' | 'CLOSED';

export class HungerStationSessionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HungerStationSessionError';
  }
}

export class HungerStationBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HungerStationBlockedError';
  }
}

const LIST_ORDERS_QUERY = `
query ListOrders($params: ListOrdersReq!) {
  orders {
    listOrders(input: $params) {
      nextPageToken
      resultTimestamp
      orders {
        orderId
        globalEntityId
        vendorId
        vendorName
        orderStatus
        placedTimestamp
        subtotal
        billableStatus
        deliveryType
        billing { commissionAmount netRevenue }
      }
    }
  }
}`;

const ORDERS_CONFIG_QUERY = `
query OrdersConfig($params: ConfigRequest!) {
  config {
    config(input: $params) {
      pluginConfigs {
        orders { billableFilterEnabled }
      }
    }
  }
}`;

const GET_ORDER_DETAIL_QUERY = `
query GetOrderDetails($params: OrderReq!, $orderIssueParams: OrderIssuePicturesReq!, $hasPhotoEvidence: Boolean!) {
  orders {
    order(input: $params) {
      order {
        orderId
        placedTimestamp
        status
        globalEntityId
        vendorId
        vendorName
        orderValue
        billableStatus
        items {
          id: productId
          name
          quantity
          unitPrice
          lineItemTotal
        }
      }
    }
  }
}`;

/** Real OneWeb dashboard queries (partner-app / Ecommerce-workflow). */
const SALES_OVERVIEW_BY_TIME_QUERY = `
query SalesOverviewByTime($params: DateRangeWithPrecisionVendorsReportRequest!) {
  salesOverview {
    salesByTime(input: $params) {
      order_count
      revenue
      details {
        order_count
        revenue
        milestone
        __typename
      }
      __typename
    }
    __typename
  }
}`;

const OPS_HEALTH_QUERY = `
query OpsHealth($params: VendorsReportRequest!) {
  reports {
    operationsHealthMetric(input: $params) {
      avgPreparationTime { current previous isGrowthPositive dataType __typename }
      delayRate { current previous isGrowthPositive dataType __typename }
      rejections { current previous isGrowthPositive dataType __typename }
      offlineDuration { current previous isGrowthPositive dataType __typename }
      scheduledDuration { current previous isGrowthPositive dataType __typename }
      __typename
    }
    __typename
  }
}`;

const TODAY_ISSUES_QUERY = `
query TodayIssues($cancelledOrdersCountParams: OrdersCountReq!, $delayedOrdersCountParams: OrdersCountReq!, $issuesMetricParams: DateRangeVendorsMetricRequest!) {
  orders {
    cancelledOrders: ordersCount(input: $cancelledOrdersCountParams) { amount __typename }
    delayedOrders: ordersCount(input: $delayedOrdersCountParams) { amount __typename }
    __typename
  }
  reports {
    issuesMetric(input: $issuesMetricParams) {
      offlineVendorsCount
      oneStarRatingsCount
      oneStarRatingsDetails { global_vendor_code count __typename }
      __typename
    }
    __typename
  }
}`;

const LATEST_REVIEWS_QUERY = `
query LatestReviews($reviewVars: BatchReviewsRequest!, $ratingVars: GetAvgCustomerRatingRequest!, $withAvgRating: Boolean!) {
  customerReview {
    reviews(input: $reviewVars) {
      maxRating
      reviews { date globalVendorCode id rating text vendorPills __typename }
      __typename
    }
    ratings(input: $ratingVars) @include(if: $withAvgRating) {
      avgRatings { avgRating maxAllowedRating __typename }
      __typename
    }
    __typename
  }
}`;

const LIST_PAYOUTS_QUERY = `
query ListPayouts($params: ListPayoutsRequest!) {
  finances {
    listPayouts(input: $params) {
      nextPageToken
      prevPageToken
      payouts {
        payoutId: id
        payoutAmount: netPayout
        payoutCurrency: currency
        payoutOrders: ordersCount
        at: paymentDateLocal
        status: payoutStatus
        invoices {
          invoiceId: id
          invoiceAmount: totalPayout
          invoiceCurrency: currency
          invoiceOrders: ordersCount
          processedDate
          period: earningsPeriod { from: invoiceStartDate to: invoiceEndDate __typename }
          __typename
        }
        __typename
      }
      __typename
    }
    __typename
  }
}`;

const LIST_FINANCE_ACCOUNTS_QUERY = `
query ListFinanceAccounts($params: ListAccountsRequest!) {
  finances {
    listAccounts(input: $params) {
      accounts {
        id
        currency
        globalEntityId
        vendorId
        __typename
      }
      __typename
    }
    __typename
  }
}`;

const LIST_FINANCE_ACCOUNTS_QUERY_ALT = `
query ListFinanceAccounts($globalEntityId: String!) {
  finances {
    listAccounts(input: { globalEntityId: $globalEntityId }) {
      accounts {
        id
        currency
        globalEntityId
        vendorId
        __typename
      }
      __typename
    }
    __typename
  }
}`;

const VENDOR_FINANCE_ACCOUNTS_QUERY = `
query VendorFinanceAccounts($params: VendorReq!) {
  vendors {
    vendor(input: $params) {
      accounts {
        id
        currency
        globalEntityId
        vendorId
        __typename
      }
      financeAccounts {
        id
        currency
        globalEntityId
        vendorId
        __typename
      }
      __typename
    }
    __typename
  }
}`;

const USER_FINANCE_ACCOUNTS_QUERY = `
query UserFinanceAccounts {
  user {
    accounts {
      id
      currency
      globalEntityId
      vendorId
      __typename
    }
    __typename
  }
}`;

@Injectable()
export class HungerStationClient {
  private readonly logger = new Logger(HungerStationClient.name);

  constructor(private readonly bridge: ExtensionBridgeService) {}

  resolveCookies(credentials: CredentialPayload): Record<string, string> {
    const out: Record<string, string> = {};
    const raw = credentials.cookies;
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      for (const [k, v] of Object.entries(raw)) {
        if (v != null && String(v).trim()) out[k] = String(v);
      }
    }
    const access =
      resolveAccessToken(credentials) ||
      (typeof credentials.accessToken === 'string'
        ? credentials.accessToken
        : '');
    if (access) out.accessToken = access;
    if (typeof credentials.refreshToken === 'string' && credentials.refreshToken) {
      out.refreshToken = credentials.refreshToken;
    }
    if (typeof credentials.deviceToken === 'string' && credentials.deviceToken) {
      out.deviceToken = credentials.deviceToken;
    }
    if (typeof credentials.pxCookie === 'string' && credentials.pxCookie) {
      out._px3 = credentials.pxCookie;
    }

    // Manual finance accounts override (JSON array) for ListPayouts.
    const financeRaw =
      credentials.financeAccountsJson ??
      credentials.financeAccounts ??
      credentials.__accounts;
    if (financeRaw != null && !out.__accounts) {
      try {
        const parsed =
          typeof financeRaw === 'string' ? JSON.parse(financeRaw) : financeRaw;
        const normalized = this.normalizeFinanceAccounts(parsed);
        if (normalized.length) {
          out.__accounts = JSON.stringify(normalized);
        }
      } catch {
        /* ignore invalid manual accounts */
      }
    }
    return out;
  }

  resolveVendorId(
    credentials: CredentialPayload,
    cookies: Record<string, string>,
  ): string {
    if (typeof credentials.vendorId === 'string' && credentials.vendorId.trim()) {
      return credentials.vendorId.trim();
    }
    if (
      typeof credentials.merchantId === 'string' &&
      credentials.merchantId.trim()
    ) {
      return credentials.merchantId.trim();
    }
    return extractVendorId(cookies);
  }

  private gqlHeaders(cookies: Record<string, string>): Record<string, string> {
    const accessToken = String(cookies.accessToken || '').trim();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: '*/*',
      'Accept-Language': 'ar',
      Authorization: `Bearer ${accessToken}`,
      Origin: 'https://partner-app.hungerstation.com',
      Referer: 'https://partner-app.hungerstation.com/',
      'x-global-entity-id': HS_GLOBAL_ENTITY_ID,
      'x-fp-api-key': 'partner',
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
    };
    const cookie = cookieHeader(cookies);
    if (cookie) headers.Cookie = cookie;
    if (cookies._px3) headers['x-px-cookies'] = `_px3=${cookies._px3}`;
    return headers;
  }

  private formatGqlErrors(errors: unknown[]): string {
    if (!errors.length) return 'GraphQL error';
    return errors
      .map((entry) => {
        const e = asRecord(entry);
        const msg = String(e.message ?? '').trim() || 'GraphQL error';
        const path = Array.isArray(e.path) ? e.path.join('.') : '';
        const ext = asRecord(e.extensions);
        const code = String(ext.code ?? ext.errorType ?? '').trim();
        const parts = [msg];
        if (code) parts.push(`[${code}]`);
        if (path) parts.push(`@ ${path}`);
        // Surface validation payloads (often why ListPayouts fails).
        const detail =
          ext.exception ??
          ext.validationErrors ??
          ext.response ??
          ext.errors ??
          null;
        if (detail != null) {
          try {
            const raw = JSON.stringify(detail);
            if (raw && raw !== '{}' && raw !== 'null') {
              parts.push(raw.slice(0, 400));
            }
          } catch {
            /* ignore */
          }
        }
        return parts.join(' ');
      })
      .join(' | ');
  }

  async gqlDirect(
    cookies: Record<string, string>,
    operation: string,
    query: string,
    variables: Record<string, unknown>,
  ): Promise<unknown> {
    const accessToken = String(cookies.accessToken || '').trim();
    if (!accessToken) {
      throw new HungerStationSessionError('session_expired');
    }

    const res = await providerFetch<Record<string, unknown>>({
      method: 'POST',
      url: HS_GRAPHQL_URL,
      headers: this.gqlHeaders(cookies),
      body: { operationName: operation, variables, query },
      timeoutMs: 30_000,
      raw: true,
    });

    if (res.status === 401) {
      throw new HungerStationSessionError('session_expired');
    }
    if (res.status === 403) {
      throw new HungerStationBlockedError('perimeter_x_blocked');
    }
    if (!res.ok) {
      throw new ProviderHttpError(
        `HS GraphQL HTTP ${res.status}`,
        res.status,
        res.data,
        HS_GRAPHQL_URL,
      );
    }

    const errors = asArray(asRecord(res.data).errors);
    if (errors.length) {
      const msg = this.formatGqlErrors(errors);
      if (/unauthor|unauthentic/i.test(msg)) {
        throw new HungerStationSessionError(msg);
      }
      throw new Error(msg);
    }

    return asRecord(res.data).data;
  }

  async gql(
    cookies: Record<string, string>,
    operation: string,
    query: string,
    variables: Record<string, unknown>,
  ): Promise<unknown> {
    if (this.bridge.isConnected('hungerstation')) {
      try {
        return await this.bridge.sendCommand('hungerstation', 'gql', {
          operation,
          query,
          variables,
        });
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        if (
          msg.includes('extension_not_connected') ||
          msg.includes('extension_timeout') ||
          msg.includes('extension_disconnected')
        ) {
          this.logger.warn(`HS extension gql failed (${msg}); trying direct`);
        } else if (/session_expired|unauthor/i.test(msg)) {
          throw new HungerStationSessionError(msg);
        } else if (/perimeter/i.test(msg)) {
          throw new HungerStationBlockedError(msg);
        } else {
          throw error;
        }
      }
    }
    return this.gqlDirect(cookies, operation, query, variables);
  }

  async rest(
    cookies: Record<string, string>,
    url: string,
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'GET',
    body?: unknown,
  ): Promise<unknown> {
    if (this.bridge.isConnected('hungerstation')) {
      return this.bridge.sendCommand('hungerstation', 'rest', {
        url,
        method,
        body: body ?? null,
      });
    }

    const res = await providerFetch({
      method,
      url,
      headers: this.gqlHeaders(cookies),
      body,
      timeoutMs: 45_000,
      raw: true,
    });
    if (res.status === 401) {
      throw new HungerStationSessionError('session_expired');
    }
    if (res.status === 403) {
      throw new HungerStationBlockedError('perimeter_x_blocked');
    }
    if (!res.ok) {
      const data = asRecord(res.data);
      const chunks: string[] = [];
      for (const key of ['message', 'error', 'detail', 'errorMessage'] as const) {
        const value = data[key];
        if (typeof value === 'string' && value.trim()) chunks.push(value.trim());
      }
      for (const row of asArray(
        data.constraintViolations ?? data.violations ?? data.errors,
      )) {
        if (typeof row === 'string' && row.trim()) {
          chunks.push(row.trim());
          continue;
        }
        const rec = asRecord(row);
        const msg = String(rec.message ?? rec.reason ?? '').trim();
        if (!msg) continue;
        const field = String(rec.field ?? rec.path ?? '').trim();
        chunks.push(field ? `${field}: ${msg}` : msg);
      }
      const detail = [...new Set(chunks)].join(' · ');
      throw new ProviderHttpError(
        detail
          ? `HS REST HTTP ${res.status}: ${detail}`
          : `HS REST HTTP ${res.status}`,
        res.status,
        res.data,
        url,
      );
    }
    return res.data;
  }

  async validateSession(cookies: Record<string, string>): Promise<boolean> {
    try {
      await this.gql(cookies, 'OrdersConfig', ORDERS_CONFIG_QUERY, {
        params: { globalEntityId: HS_GLOBAL_ENTITY_ID },
      });
      return true;
    } catch (error) {
      this.logger.warn(
        `HS validateSession failed: ${error instanceof Error ? error.message : error}`,
      );
      return false;
    }
  }

  async listOrders(input: {
    cookies: Record<string, string>;
    vendorId: string;
    pageSize?: number;
    nextPageToken?: string | null;
    daysBack?: number;
    timeFrom?: string | Date;
    timeTo?: string | Date;
  }) {
    const now = input.timeTo ? new Date(input.timeTo) : new Date();
    const from = input.timeFrom
      ? new Date(input.timeFrom)
      : new Date(
          now.getTime() - (input.daysBack ?? 14) * 24 * 60 * 60 * 1000,
        );
    const pagination: Record<string, unknown> = {
      pageSize: input.pageSize ?? 50,
    };
    if (input.nextPageToken) pagination.pageToken = input.nextPageToken;

    const params = {
      pagination,
      timeFrom: from.toISOString().replace(/\.\d{3}Z$/, '.000Z'),
      timeTo: now.toISOString().replace(/\.\d{3}Z$/, '.999Z'),
      globalVendorCodes: [
        {
          globalEntityId: HS_GLOBAL_ENTITY_ID,
          vendorId: input.vendorId,
        },
      ],
    };

    this.logger.log(
      `HS listOrders vendor=${input.vendorId} from=${params.timeFrom} to=${params.timeTo}`,
    );

    const data = asRecord(
      await this.gql(input.cookies, 'ListOrders', LIST_ORDERS_QUERY, {
        params,
      }),
    );

    const page = asRecord(asRecord(data.orders).listOrders);
    const count = asArray(page.orders).length;
    this.logger.log(`HS listOrders returned ${count} order(s)`);
    return page;
  }

  async getOrderDetail(input: {
    cookies: Record<string, string>;
    vendorId: string;
    orderId: string;
  }) {
    const data = asRecord(
      await this.gql(input.cookies, 'GetOrderDetails', GET_ORDER_DETAIL_QUERY, {
        params: {
          orderId: input.orderId,
          globalEntityId: HS_GLOBAL_ENTITY_ID,
          vendorId: input.vendorId,
        },
        orderIssueParams: {
          orderId: input.orderId,
          globalEntityId: HS_GLOBAL_ENTITY_ID,
          vendorId: input.vendorId,
        },
        hasPhotoEvidence: false,
      }),
    );
    return asRecord(asRecord(asRecord(data.orders).order).order);
  }

  /** Object form used by orders / some metrics. */
  private vendorCodes(vendorId: string) {
    return [
      {
        globalEntityId: HS_GLOBAL_ENTITY_ID,
        vendorId,
      },
    ];
  }

  /** String form used by sales/ops/reviews/performance (`HS_SA;vendorId`). */
  private vendorCodeStrings(vendorId: string): string[] {
    return [`${HS_GLOBAL_ENTITY_ID};${vendorId}`];
  }

  /** Asia/Riyadh calendar date YYYY-MM-DD (UTC+3). */
  private riyadhDate(d = new Date()): string {
    const shifted = new Date(d.getTime() + 3 * 60 * 60 * 1000);
    return shifted.toISOString().slice(0, 10);
  }

  private resolveDateRange(input?: {
    timeFrom?: string | Date;
    timeTo?: string | Date;
    daysBack?: number;
  }): { from: string; to: string } {
    const toRaw = input?.timeTo ? new Date(input.timeTo) : new Date();
    const fromRaw = input?.timeFrom
      ? new Date(input.timeFrom)
      : new Date(
          toRaw.getTime() -
            (input?.daysBack ?? 7) * 24 * 60 * 60 * 1000,
        );
    return {
      from: this.riyadhDate(fromRaw),
      to: this.riyadhDate(toRaw),
    };
  }

  private resolveTimeRange(input?: {
    timeFrom?: string | Date;
    timeTo?: string | Date;
    daysBack?: number;
  }): { timeFrom: string; timeTo: string } {
    const now = input?.timeTo ? new Date(input.timeTo) : new Date();
    const from = input?.timeFrom
      ? new Date(input.timeFrom)
      : new Date(
          now.getTime() -
            (input?.daysBack ?? 7) * 24 * 60 * 60 * 1000,
        );
    return {
      timeFrom: from.toISOString().replace(/\.\d{3}Z$/, '.000Z'),
      timeTo: now.toISOString().replace(/\.\d{3}Z$/, '.999Z'),
    };
  }

  private gqlPrecision(granularity?: HsSalesGranularity): string {
    const g = String(granularity ?? 'DAY').toUpperCase();
    if (g === 'HOUR') return 'Hour';
    if (g === 'MONTH') return 'Month';
    return 'Day';
  }

  private restPrecision(granularity?: HsSalesGranularity): string {
    const g = String(granularity ?? 'DAY').toUpperCase();
    if (g === 'HOUR' || g === 'MONTH') return g;
    return 'DAY';
  }

  /** Partner portal BFF login (email/password). May still hit PerimeterX from server IP. */
  async loginWithPassword(input: {
    email: string;
    password: string;
  }): Promise<{
    accessToken: string;
    refreshToken: string | null;
    raw: Record<string, unknown>;
  }> {
    const email = input.email.trim();
    const password = input.password;
    if (!email || !password) {
      throw new ProviderHttpError(
        'HUNGERSTATION login: email و password مطلوبان',
        400,
        null,
        HS_BFF_LOGIN_URL,
      );
    }

    const res = await providerFetch<Record<string, unknown>>({
      method: 'POST',
      url: HS_BFF_LOGIN_URL,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Origin: 'https://partner-app.hungerstation.com',
        Referer: 'https://partner-app.hungerstation.com/',
        'x-global-entity-id': HS_GLOBAL_ENTITY_ID,
        'x-fp-api-key': 'partner',
      },
      body: {
        username: email,
        email,
        password,
        globalEntityId: HS_GLOBAL_ENTITY_ID,
      },
      timeoutMs: 30_000,
      raw: true,
    });

    if (res.status === 403) {
      throw new HungerStationBlockedError('perimeter_x_blocked');
    }
    if (!res.ok) {
      throw new ProviderHttpError(
        `HUNGERSTATION login HTTP ${res.status}`,
        res.status,
        res.data,
        HS_BFF_LOGIN_URL,
      );
    }

    const data = asRecord(res.data);
    const nested = asRecord(data.data ?? data.result ?? data);
    const accessToken = String(
      data.accessToken ??
        data.access_token ??
        nested.accessToken ??
        nested.access_token ??
        '',
    ).trim();
    if (!accessToken) {
      throw new ProviderHttpError(
        'HUNGERSTATION login: missing accessToken',
        502,
        data,
        HS_BFF_LOGIN_URL,
      );
    }

    const refreshTokenRaw =
      data.refreshToken ??
      data.refresh_token ??
      nested.refreshToken ??
      nested.refresh_token;
    return {
      accessToken,
      refreshToken:
        refreshTokenRaw != null && String(refreshTokenRaw).trim()
          ? String(refreshTokenRaw).trim()
          : null,
      raw: data,
    };
  }

  private isRouteMissError(error: unknown): boolean {
    const msg = error instanceof Error ? error.message : String(error);
    return /no Route matched|Cannot query field|Unknown type|Unknown argument/i.test(
      msg,
    );
  }

  /** Try primary GraphQL shape, then alternates on schema/route mismatch. */
  private async gqlWithFallback(
    cookies: Record<string, string>,
    operation: string,
    variants: Array<{
      query: string;
      pick: (data: Record<string, unknown>) => unknown;
    }>,
    variables: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    let lastError: unknown;
    for (const variant of variants) {
      try {
        const data = asRecord(
          await this.gql(cookies, operation, variant.query, variables),
        );
        return asRecord(variant.pick(data));
      } catch (error) {
        lastError = error;
        if (!this.isRouteMissError(error)) throw error;
        this.logger.warn(
          `HS ${operation} schema miss, trying next variant: ${error instanceof Error ? error.message : error}`,
        );
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new Error(String(lastError ?? `${operation}_failed`));
  }

  async salesOverviewByTime(input: {
    cookies: Record<string, string>;
    vendorId: string;
    granularity?: HsSalesGranularity;
    timeFrom?: string | Date;
    timeTo?: string | Date;
    daysBack?: number;
  }) {
    const range = this.resolveDateRange(input);
    const data = asRecord(
      await this.gql(
        input.cookies,
        'SalesOverviewByTime',
        SALES_OVERVIEW_BY_TIME_QUERY,
        {
          params: {
            global_vendor_codes: this.vendorCodeStrings(input.vendorId),
            from: range.from,
            to: range.to,
            precision: this.gqlPrecision(input.granularity),
          },
        },
      ),
    );
    return asRecord(asRecord(data.salesOverview).salesByTime);
  }

  async opsHealth(input: {
    cookies: Record<string, string>;
    vendorId: string;
    timeFrom?: string | Date;
    timeTo?: string | Date;
    daysBack?: number;
  }) {
    const data = asRecord(
      await this.gql(input.cookies, 'OpsHealth', OPS_HEALTH_QUERY, {
        params: {
          global_vendor_codes: this.vendorCodeStrings(input.vendorId),
        },
      }),
    );
    return asRecord(asRecord(data.reports).operationsHealthMetric);
  }

  async todayIssues(input: {
    cookies: Record<string, string>;
    vendorId: string;
  }) {
    const now = new Date();
    const today = this.riyadhDate(now);
    // HungerStation operational day: 21:00 UTC previous calendar day → 20:59:59 UTC
    const dayStart = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        21,
        0,
        0,
        0,
      ),
    );
    dayStart.setUTCDate(dayStart.getUTCDate() - 1);
    const dayEnd = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        20,
        59,
        59,
        999,
      ),
    );
    const timeFrom = dayStart.toISOString().replace(/\.\d{3}Z$/, '.000Z');
    const timeTo = dayEnd.toISOString().replace(/\.\d{3}Z$/, '.999Z');
    const vendorObj = {
      globalEntityId: HS_GLOBAL_ENTITY_ID,
      vendorId: input.vendorId,
    };
    const vendorCode = `${HS_GLOBAL_ENTITY_ID};${input.vendorId}`;

    const data = asRecord(
      await this.gql(input.cookies, 'TodayIssues', TODAY_ISSUES_QUERY, {
        issuesMetricParams: {
          global_vendor_codes: [vendorCode],
          from: today,
          to: today,
        },
        cancelledOrdersCountParams: {
          globalVendorCodes: [vendorObj],
          disableLimit: true,
          timeFrom,
          timeTo,
          filter: { orderStatuses: ['CANCELLED'] },
        },
        delayedOrdersCountParams: {
          globalVendorCodes: [vendorObj],
          disableLimit: true,
          timeFrom,
          timeTo,
          filter: { isDelayedOrder: true },
        },
      }),
    );
    const orders = asRecord(data.orders);
    const reports = asRecord(data.reports);
    return {
      cancelled_orders: asRecord(orders.cancelledOrders).amount ?? 0,
      delayed_orders: asRecord(orders.delayedOrders).amount ?? 0,
      issues: asRecord(reports.issuesMetric),
    };
  }

  async latestReviews(input: {
    cookies: Record<string, string>;
    vendorId: string;
    pageSize?: number;
    daysBack?: number;
  }) {
    const now = new Date();
    const days = input.daysBack ?? 7;
    const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const vendorCode = `${HS_GLOBAL_ENTITY_ID};${input.vendorId}`;
    const data = asRecord(
      await this.gql(input.cookies, 'LatestReviews', LATEST_REVIEWS_QUERY, {
        reviewVars: {
          global_vendor_codes: [vendorCode],
          pagination: { perPage: input.pageSize ?? 20 },
          filter: {
            ratingMin: 1,
            endDate: now.toISOString(),
            startDate: start.toISOString(),
          },
        },
        ratingVars: { global_vendor_codes: [vendorCode] },
        withAvgRating: true,
      }),
    );
    return asRecord(data.customerReview);
  }

  private accountsFromAccessToken(
    accessToken: unknown,
  ): Record<string, unknown>[] {
    const token = String(accessToken ?? '').trim();
    if (!token || token.split('.').length < 2) return [];
    try {
      const payloadB64 = token.split('.')[1] ?? '';
      const json = Buffer.from(
        payloadB64.replace(/-/g, '+').replace(/_/g, '/'),
        'base64',
      ).toString('utf8');
      const payload = asRecord(JSON.parse(json));
      const candidates = [
        payload.accounts,
        payload.accountIds,
        payload.financeAccounts,
        asRecord(payload.user).accounts,
        asRecord(payload.data).accounts,
      ];
      for (const c of candidates) {
        const normalized = this.normalizeFinanceAccounts(c);
        if (normalized.length) return normalized;
      }
      // Some tokens store a single accountId.
      const single = String(
        payload.accountId ?? payload.financeAccountId ?? '',
      ).trim();
      if (single) {
        return [
          {
            id: single,
            currency: String(payload.currency ?? 'SAR'),
            globalEntityId: HS_GLOBAL_ENTITY_ID,
          },
        ];
      }
    } catch {
      /* ignore */
    }
    return [];
  }

  private normalizeFinanceAccounts(raw: unknown): Record<string, unknown>[] {
    const out: Record<string, unknown>[] = [];
    const seen = new Set<string>();
    const push = (row: Record<string, unknown>) => {
      const id = String(row.id ?? row.accountId ?? '').trim();
      if (!id || seen.has(id)) return;
      seen.add(id);
      out.push({
        id,
        currency: String(row.currency ?? 'SAR'),
        globalEntityId: String(row.globalEntityId ?? HS_GLOBAL_ENTITY_ID),
        ...(row.vendorId != null
          ? { vendorId: String(row.vendorId) }
          : {}),
      });
    };
    const walk = (node: unknown, depth = 0) => {
      if (node == null || depth > 6) return;
      if (Array.isArray(node)) {
        for (const item of node) {
          const rec = asRecord(item);
          if (rec.id || rec.accountId) push(rec);
          else walk(item, depth + 1);
        }
        return;
      }
      const rec = asRecord(node);
      if (rec.id && (rec.currency != null || rec.globalEntityId != null)) {
        push(rec);
      }
      for (const key of [
        'accounts',
        'financeAccounts',
        'listAccounts',
        'data',
      ]) {
        if (rec[key] != null) walk(rec[key], depth + 1);
      }
    };
    walk(raw);
    return out;
  }

  async listFinanceAccounts(input: {
    cookies: Record<string, string>;
    vendorId: string;
  }): Promise<Record<string, unknown>[]> {
    const cached = input.cookies.__accounts;
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        const normalized = this.normalizeFinanceAccounts(parsed);
        if (normalized.length) return normalized;
      } catch {
        /* ignore bad cache */
      }
    }

    // Extension may have scraped/cached accounts from partner-app.
    if (this.bridge.isConnected('hungerstation')) {
      try {
        const fromExt = await this.bridge.sendCommand(
          'hungerstation',
          'finance_accounts',
          { vendorId: input.vendorId },
          90_000,
        );
        const extRec = asRecord(fromExt);
        if (extRec.debug) {
          this.logger.warn(
            `HS finance_accounts debug: ${JSON.stringify(extRec.debug).slice(0, 1500)}`,
          );
        }
        const normalized = this.normalizeFinanceAccounts(fromExt);
        if (normalized.length) return normalized;
      } catch (error) {
        this.logger.warn(
          `HS finance_accounts extension failed: ${error instanceof Error ? error.message : error}`,
        );
      }
    }

    // JWT claims sometimes embed account ids.
    const fromJwt = this.accountsFromAccessToken(input.cookies.accessToken);
    if (fromJwt.length) {
      this.logger.log(`HS finance accounts from JWT: ${fromJwt.length}`);
      return fromJwt;
    }

    const attempts: Array<{
      operation: string;
      query: string;
      variables: Record<string, unknown>;
      pick: (data: Record<string, unknown>) => unknown;
    }> = [
      {
        operation: 'ListFinanceAccounts',
        query: LIST_FINANCE_ACCOUNTS_QUERY,
        variables: {
          params: {
            globalEntityId: HS_GLOBAL_ENTITY_ID,
            pagination: { pageSize: 50 },
          },
        },
        pick: (d) => asRecord(asRecord(d.finances).listAccounts).accounts,
      },
      {
        operation: 'ListFinanceAccounts',
        query: LIST_FINANCE_ACCOUNTS_QUERY,
        variables: {
          params: {
            globalEntityId: HS_GLOBAL_ENTITY_ID,
            vendorIds: [input.vendorId],
            pagination: { pageSize: 50 },
          },
        },
        pick: (d) => asRecord(asRecord(d.finances).listAccounts).accounts,
      },
      {
        operation: 'ListFinanceAccounts',
        query: LIST_FINANCE_ACCOUNTS_QUERY_ALT,
        variables: { globalEntityId: HS_GLOBAL_ENTITY_ID },
        pick: (d) => asRecord(asRecord(d.finances).listAccounts).accounts,
      },
      {
        operation: 'VendorFinanceAccounts',
        query: VENDOR_FINANCE_ACCOUNTS_QUERY,
        variables: {
          params: {
            globalEntityId: HS_GLOBAL_ENTITY_ID,
            vendorId: input.vendorId,
          },
        },
        pick: (d) => asRecord(asRecord(d.vendors).vendor),
      },
      {
        operation: 'UserFinanceAccounts',
        query: USER_FINANCE_ACCOUNTS_QUERY,
        variables: {},
        pick: (d) => asRecord(d.user).accounts,
      },
    ];

    for (const attempt of attempts) {
      try {
        const data = asRecord(
          await this.gql(
            input.cookies,
            attempt.operation,
            attempt.query,
            attempt.variables,
          ),
        );
        const normalized = this.normalizeFinanceAccounts(attempt.pick(data));
        if (normalized.length) return normalized;
      } catch (error) {
        this.logger.warn(
          `HS listFinanceAccounts ${attempt.operation} failed: ${error instanceof Error ? error.message : error}`,
        );
      }
    }

    // REST fallbacks used by some OneWeb builds.
    const restUrls = [
      `https://vos-api.eu.prd.portal.restaurant/v1/finances/accounts?globalEntityId=${HS_GLOBAL_ENTITY_ID}`,
      `https://vos-api.eu.prd.portal.restaurant/v1/vendors/${encodeURIComponent(input.vendorId)}/accounts`,
      `${this.vendorBase(input.vendorId)}/accounts`,
    ];
    for (const url of restUrls) {
      try {
        const raw = await this.rest(input.cookies, url, 'GET');
        const normalized = this.normalizeFinanceAccounts(raw);
        if (normalized.length) return normalized;
      } catch (error) {
        this.logger.warn(
          `HS finance accounts REST miss ${url}: ${error instanceof Error ? error.message : error}`,
        );
      }
    }

    return [];
  }

  async listPayouts(input: {
    cookies: Record<string, string>;
    vendorId: string;
    pageSize?: number;
    nextPageToken?: string | null;
    timeFrom?: string | Date;
    timeTo?: string | Date;
    daysBack?: number;
    accounts?: Record<string, unknown>[];
  }) {
    const range = this.resolveDateRange({
      timeFrom: input.timeFrom,
      timeTo: input.timeTo,
      daysBack: input.daysBack ?? 30,
    });
    let accounts = this.normalizeFinanceAccounts(
      input.accounts ??
        (await this.listFinanceAccounts({
          cookies: input.cookies,
          vendorId: input.vendorId,
        })),
    );

    if (!accounts.length) {
      // Probe whether finances.listPayouts even exists for this session.
      try {
        await this.gql(input.cookies, 'ListPayouts', LIST_PAYOUTS_QUERY, {
          params: {
            startDate: range.from,
            endDate: range.to,
            pagination: { pageSize: 1 },
            globalEntityId: HS_GLOBAL_ENTITY_ID,
            accounts: [
              {
                id: input.vendorId,
                currency: 'SAR',
                globalEntityId: HS_GLOBAL_ENTITY_ID,
                vendorId: input.vendorId,
              },
            ],
          },
        });
        accounts.push({
          id: input.vendorId,
          currency: 'SAR',
          globalEntityId: HS_GLOBAL_ENTITY_ID,
          vendorId: input.vendorId,
        });
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        this.logger.warn(`HS ListPayouts vendor-id probe: ${msg}`);
        // Soft-fail: other report sections still work.
        return {
          payouts: [],
          unavailable: true,
          reason: 'finance_accounts_unavailable',
          hint:
            'حساب هذا المتجر لا يعرض موديول المالية في partner-app، أو لا توجد صلاحية للدفعات. يمكنك لصق financeAccountsJson يدوياً في بيانات الاعتماد إن توفر معرف الحساب.',
          detail: msg.slice(0, 300),
        };
      }
    }

    const pagination: Record<string, unknown> = {
      pageSize: input.pageSize ?? 10,
    };
    if (input.nextPageToken) pagination.pageToken = input.nextPageToken;

    // ListPayouts validates accounts strictly — try object shapes and omit empty filter.
    const paramVariants: Record<string, unknown>[] = [
      {
        startDate: range.from,
        endDate: range.to,
        pagination,
        globalEntityId: HS_GLOBAL_ENTITY_ID,
        accounts,
      },
      {
        startDate: range.from,
        endDate: range.to,
        filter: {},
        pagination,
        globalEntityId: HS_GLOBAL_ENTITY_ID,
        accounts,
      },
      {
        startDate: range.from,
        endDate: range.to,
        pagination,
        globalEntityId: HS_GLOBAL_ENTITY_ID,
        accounts: accounts.map((a) => ({
          id: a.id,
          currency: a.currency,
          globalEntityId: a.globalEntityId,
        })),
      },
      {
        startDate: range.from,
        endDate: range.to,
        pagination,
        globalEntityId: HS_GLOBAL_ENTITY_ID,
        accounts: accounts.map((a) => ({
          id: a.id,
          currency: a.currency,
        })),
      },
    ];

    let lastError: unknown;
    for (const params of paramVariants) {
      try {
        const data = asRecord(
          await this.gql(input.cookies, 'ListPayouts', LIST_PAYOUTS_QUERY, {
            params,
          }),
        );
        return asRecord(asRecord(data.finances).listPayouts);
      } catch (error) {
        lastError = error;
        this.logger.warn(
          `HS listPayouts variant failed: ${error instanceof Error ? error.message : error}`,
        );
      }
    }

    return {
      payouts: [],
      unavailable: true,
      reason: 'list_payouts_failed',
      hint: 'تعذّر جلب الدفعات من بوابة الشريك لهذا الحساب.',
      detail:
        lastError instanceof Error
          ? lastError.message.slice(0, 300)
          : String(lastError ?? ''),
    };
  }

  vendorBase(vendorId: string): string {
    return `${HS_VENDOR_API_BASE}/${encodeURIComponent(vendorId)}`;
  }

  async setAvailability(input: {
    cookies: Record<string, string>;
    vendorId: string;
    availability: HsStoreAvailability | boolean;
    closedReason?: string;
    closedUntil?: string;
  }) {
    const open =
      typeof input.availability === 'boolean'
        ? input.availability
        : String(input.availability).toUpperCase() === 'OPEN';
    // Match OneWeb / Ecommerce-workflow vendor status API.
    const closedReason = input.closedReason?.trim() || 'CLOSED';
    const status = open ? 'OPEN' : 'CLOSED_TODAY';

    if (!this.bridge.isConnected('hungerstation') && !input.cookies.accessToken) {
      throw new ProviderHttpError(
        'HUNGERSTATION: افتح الإكستنشن وسجّل دخول بوابة الشريك ثم احفظ الجلسة لفتح/إغلاق المتجر.',
        503,
        { extensionConnected: false },
        'hungerstation-availability',
      );
    }

    const body: Record<string, unknown> = {
      changeable: true,
      availabilityState: status,
    };
    if (!open) {
      body.closedReason = closedReason;
      if (input.closedUntil?.trim()) {
        body.closedUntil = input.closedUntil.trim();
      }
    }

    const vid = encodeURIComponent(input.vendorId);
    const urls = [
      `${HS_VENDOR_STATUS_API_BASE}/${HS_GLOBAL_ENTITY_ID}/vendors/${vid}/availability`,
      `${this.vendorBase(input.vendorId)}/availability`,
    ];

    let lastError: unknown;
    for (const url of urls) {
      try {
        const raw = await this.rest(input.cookies, url, 'PUT', body);
        return asRecord(raw ?? { available: open, status, availabilityState: status });
      } catch (error) {
        lastError = error;
        const msg = error instanceof Error ? error.message : String(error);
        this.logger.warn(`HS availability PUT failed (${url}): ${msg}`);
        if (/session_expired|perimeter|401|unauthor/i.test(msg)) {
          throw error;
        }
      }
    }

    throw new ProviderHttpError(
      'HUNGERSTATION: تعذّر فتح/إغلاق المتجر عبر جلسة الإكستنشن. تأكد أن الإكستنشن متصل وأنك مسجّل في partner-app، ثم أعد حفظ الجلسة.',
      502,
      {
        extensionConnected: this.bridge.isConnected('hungerstation'),
        lastError:
          lastError instanceof Error
            ? lastError.message
            : String(lastError ?? ''),
      },
      'hungerstation-availability',
    );
  }

  async getOpeningTimes(input: {
    cookies: Record<string, string>;
    vendorId: string;
  }) {
    const data = await this.rest(
      input.cookies,
      `${this.vendorBase(input.vendorId)}/opening_times_global.data`,
      'GET',
    );
    return asRecord(data);
  }

  async updateOpeningTimes(input: {
    cookies: Record<string, string>;
    vendorId: string;
    openingTimes: unknown;
  }) {
    return asRecord(
      await this.rest(
        input.cookies,
        `${this.vendorBase(input.vendorId)}/opening_times_global`,
        'PUT',
        input.openingTimes,
      ),
    );
  }

  async getPerformanceReport(input: {
    cookies: Record<string, string>;
    vendorId: string;
    timeFrom?: string | Date;
    timeTo?: string | Date;
    daysBack?: number;
    granularity?: HsSalesGranularity;
  }) {
    const range = this.resolveDateRange(input);
    const precision = this.restPrecision(input.granularity);
    const body = {
      global_vendor_codes: this.vendorCodeStrings(input.vendorId),
      from: range.from,
      to: range.to,
      precision,
    };
    const urls = [
      HS_PERFORMANCE_REPORT_URL,
      `https://vos-api.eu.restaurant-partners.com/v1/vendors/reports/performance`,
    ];
    let lastError: unknown;
    for (const url of urls) {
      try {
        return asRecord(await this.rest(input.cookies, url, 'POST', body));
      } catch (error) {
        lastError = error;
        const msg = error instanceof Error ? error.message : String(error);
        if (!/no Route matched|404|Not Found|http_404|Failed to fetch/i.test(msg)) {
          throw error;
        }
        this.logger.warn(`HS performance report miss at ${url}: ${msg}`);
      }
    }

    // GraphQL sales fallback when REST is blocked / unreachable
    try {
      const sales = await this.salesOverviewByTime({
        ...input,
        granularity: (precision === 'HOUR'
          ? 'HOUR'
          : precision === 'MONTH'
            ? 'MONTH'
            : 'DAY') as HsSalesGranularity,
      });
      return {
        source: 'salesOverview_fallback',
        order_count: sales.order_count,
        revenue: sales.revenue,
        details: sales.details,
        date_from: range.from,
        date_to: range.to,
        precision,
      };
    } catch {
      /* keep last REST error */
    }

    throw lastError instanceof Error
      ? lastError
      : new Error('performance_report_failed');
  }

  // ── Catalog reads / writes ───────────────────────────────────────────────

  async getCatalogs(input: {
    cookies: Record<string, string>;
    vendorId: string;
  }) {
    const data = asRecord(
      await this.rest(
        input.cookies,
        `${this.vendorBase(input.vendorId)}/catalogs`,
        'GET',
      ),
    );
    return asArray(data.catalogs ?? data.data);
  }

  async getCategoryProducts(input: {
    cookies: Record<string, string>;
    vendorId: string;
    catalogId: string;
    categoryId: string;
  }) {
    const url =
      `${this.vendorBase(input.vendorId)}/catalogs/` +
      `${encodeURIComponent(input.catalogId)}/categories/` +
      `${encodeURIComponent(input.categoryId)}/products?locale=ar-SA&sizeSupport=true`;
    const prodData = await this.rest(input.cookies, url, 'GET');
    if (Array.isArray(prodData)) return prodData.map((row) => asRecord(row));
    const rec = asRecord(prodData);
    return asArray(rec.data ?? rec.products).map((row) => asRecord(row));
  }

  async getProduct(input: {
    cookies: Record<string, string>;
    vendorId: string;
    productId: string;
  }) {
    return asRecord(
      await this.rest(
        input.cookies,
        `${this.vendorBase(input.vendorId)}/catalogs/products/${encodeURIComponent(input.productId)}`,
        'GET',
      ),
    );
  }

  extractCommandId(raw: unknown): string | null {
    const rec = asRecord(raw);
    const nested = asRecord(rec.data ?? rec.result ?? rec.command);
    const id =
      rec.commandId ??
      rec.command_id ??
      rec.id ??
      nested.commandId ??
      nested.command_id ??
      nested.id;
    return id != null && String(id).trim() ? String(id).trim() : null;
  }

  /** OneWeb rejects Arabic in top-level name; EN seed + locale bags are required. */
  private static readonly EN_NAME_SEED = 'Product';
  private static readonly EN_DESCRIPTION_SEED = 'Product description';

  private localeValue(
    entries: unknown,
    locales: string[],
  ): string {
    for (const row of asArray(entries)) {
      const item = asRecord(row);
      const locale = String(item.locale ?? '').trim();
      if (locales.includes(locale)) {
        const value = String(item.value ?? item.name ?? '').trim();
        if (value) return value;
      }
    }
    return '';
  }

  private stripLatin(text: string): string {
    return text.replace(/[a-zA-Z]/g, '').replace(/\s+/g, ' ').trim();
  }

  private hasLatin(text: string): boolean {
    return /[a-zA-Z]/.test(text);
  }

  /**
   * Build the portal product body expected by vendor-api catalogs/products.
   * Shape discovered from working OneWeb DevTools / Ecommerce-workflow.
   */
  normalizeProductWritePayload(
    input: Record<string, unknown>,
  ): Record<string, unknown> {
    const catalogId = String(
      input.catalogId ??
        (() => {
          const first = asArray(input.catalogIds)[0];
          if (first == null) return '';
          if (typeof first === 'string' || typeof first === 'number') {
            return first;
          }
          return asRecord(first).id ?? asRecord(first).catalogId ?? '';
        })() ??
        '',
    ).trim();
    const categoryId = String(
      input.categoryId ??
        (() => {
          const first = asArray(input.categories)[0];
          if (first == null) return '';
          if (typeof first === 'string' || typeof first === 'number') {
            return first;
          }
          return asRecord(first).id ?? asRecord(first).categoryId ?? '';
        })() ??
        '',
    ).trim();

    // Prefer explicit bilingual fields from the hub form.
    const explicitNameAr = String(input.nameAr ?? '').trim();
    const explicitNameEn = String(input.nameEn ?? '').trim();
    const explicitDescAr = String(input.descriptionAr ?? '').trim();
    const explicitDescEn = String(input.descriptionEn ?? '').trim();

    const nameRaw = (
      explicitNameAr ||
      explicitNameEn ||
      String(input.name ?? '').trim() ||
      this.localeValue(input.names, [
        'ar-SA',
        'ar',
        'en-SA',
        'en-US',
        'en',
      ])
    ).trim();
    const descRaw = (
      explicitDescAr ||
      explicitDescEn ||
      String(input.description ?? '').trim() ||
      this.localeValue(input.descriptions, [
        'ar-SA',
        'ar',
        'en-SA',
        'en-US',
        'en',
      ])
    ).trim();

    // ar-* fields must not contain Latin letters (HS model constraint).
    const nameArSource =
      explicitNameAr ||
      this.localeValue(input.names, ['ar-SA', 'ar']) ||
      (!this.hasLatin(nameRaw) ? nameRaw : '');
    const nameArClean = this.stripLatin(nameArSource) || 'منتج';
    const descArSource =
      explicitDescAr ||
      this.localeValue(input.descriptions, ['ar-SA', 'ar']) ||
      (!this.hasLatin(descRaw) ? descRaw : '');
    const descArClean = this.stripLatin(descArSource);

    // en-* fields must be Latin-safe; never pass Arabic into en-SA.
    const nameEnRaw =
      explicitNameEn ||
      this.localeValue(input.names, ['en-SA', 'en-US', 'en']) ||
      (this.hasLatin(nameRaw) ? nameRaw : '');
    const descEnRaw =
      explicitDescEn ||
      this.localeValue(input.descriptions, ['en-SA', 'en-US', 'en']) ||
      (this.hasLatin(descRaw) ? descRaw : '');
    const nameEn = this.hasLatin(nameEnRaw)
      ? nameEnRaw.replace(/[^\x20-\x7E]/g, '').trim() ||
        HungerStationClient.EN_NAME_SEED
      : HungerStationClient.EN_NAME_SEED;
    const descEn = this.hasLatin(descEnRaw)
      ? descEnRaw.replace(/[^\x20-\x7E]/g, '').trim() ||
        HungerStationClient.EN_DESCRIPTION_SEED
      : HungerStationClient.EN_DESCRIPTION_SEED;

    const unitPrice = Number(input.unitPrice ?? input.price ?? 0);
    const price = Number.isFinite(unitPrice) ? unitPrice : 0;

    const body: Record<string, unknown> = {
      // Portal list UI shows top-level name/description (must be EN-safe).
      name: nameEn,
      description: descEn,
      names: [
        { locale: 'ar-SA', value: nameArClean },
        { locale: 'en-SA', value: nameEn },
      ],
      descriptions: [
        { locale: 'ar-SA', value: descArClean || 'وصف المنتج' },
        { locale: 'en-SA', value: descEn },
      ],
      categories: categoryId ? [categoryId] : [],
      productOptionIds: [],
      unitPrice: price,
      catalogIds: catalogId ? [catalogId] : [],
    };

    const imageUrls = asArray(input.imageUrls ?? input.images)
      .map((row) => {
        if (typeof row === 'string') return row.trim();
        const rec = asRecord(row);
        return String(rec.url ?? rec.imageUrl ?? '').trim();
      })
      .filter((url) => /^https?:\/\//i.test(url));
    if (imageUrls.length) body.imageUrls = imageUrls;

    return body;
  }

  normalizeCategoryWritePayload(
    input: Record<string, unknown>,
  ): Record<string, unknown> {
    const nameRaw = String(
      input.name ??
        this.localeValue(input.names, [
          'ar-SA',
          'ar',
          'en-SA',
          'en-US',
          'en',
        ]) ??
        '',
    ).trim();
    const nameArSource =
      this.localeValue(input.names, ['ar-SA', 'ar']) || nameRaw;
    const nameAr = this.stripLatin(nameArSource) || nameRaw || 'فئة';
    const nameEnRaw =
      this.localeValue(input.names, ['en-SA', 'en-US', 'en']) ||
      (this.hasLatin(nameRaw) ? nameRaw : '');
    const nameEn = this.hasLatin(nameEnRaw)
      ? nameEnRaw.replace(/[^\x20-\x7E]/g, '').trim() || 'Category'
      : 'Category';
    return {
      names: [
        { locale: 'ar-SA', value: nameAr },
        { locale: 'en-SA', value: nameEn },
      ],
    };
  }

  private formatCatalogCommandFailure(
    last: Record<string, unknown>,
    status: string,
  ): string {
    const chunks: string[] = [];
    const push = (value: unknown) => {
      if (value == null) return;
      if (typeof value === 'string' && value.trim()) {
        chunks.push(value.trim());
        return;
      }
      if (typeof value === 'number' || typeof value === 'boolean') {
        chunks.push(String(value));
        return;
      }
      if (Array.isArray(value)) {
        for (const row of value) push(row);
        return;
      }
      if (typeof value === 'object') {
        const rec = asRecord(value);
        const msg =
          rec.message ??
          rec.errorMessage ??
          rec.reason ??
          rec.description ??
          rec.constraint ??
          rec.field;
        if (msg != null) {
          const field = rec.field ?? rec.path ?? rec.property;
          chunks.push(
            field != null ? `${String(field)}: ${String(msg)}` : String(msg),
          );
        }
      }
    };

    push(last.message);
    push(last.errorMessage);
    push(last.failureReason);
    push(last.reason);
    push(last.error);
    push(last.errors);
    push(last.constraintViolations);
    push(last.violations);
    push(asRecord(last.result).message);
    push(asRecord(last.data).message);
    push(asRecord(last.command).message);

    const unique = [...new Set(chunks)].filter(Boolean);
    if (!unique.length) {
      try {
        const compact = JSON.stringify(last);
        if (compact && compact !== '{}') {
          return `HUNGERSTATION catalog command failed: ${status || 'error'} — ${compact.slice(0, 600)}`;
        }
      } catch {
        // ignore
      }
      return `HUNGERSTATION catalog command failed: ${status || 'error'}`;
    }
    return `HUNGERSTATION catalog command failed: ${status || 'error'} — ${unique.join(' · ')}`;
  }

  async getCommand(input: {
    cookies: Record<string, string>;
    vendorId: string;
    commandId: string;
  }) {
    return asRecord(
      await this.rest(
        input.cookies,
        `${this.vendorBase(input.vendorId)}/catalogs/commands/${encodeURIComponent(input.commandId)}`,
        'GET',
      ),
    );
  }

  async waitForCommand(input: {
    cookies: Record<string, string>;
    vendorId: string;
    commandId: string;
    timeoutMs?: number;
    intervalMs?: number;
  }): Promise<Record<string, unknown>> {
    const timeoutMs = input.timeoutMs ?? 45_000;
    const intervalMs = input.intervalMs ?? 1_500;
    const started = Date.now();
    let last: Record<string, unknown> = {};

    while (Date.now() - started < timeoutMs) {
      last = await this.getCommand({
        cookies: input.cookies,
        vendorId: input.vendorId,
        commandId: input.commandId,
      });
      const status = String(
        last.status ?? last.state ?? asRecord(last.command).status ?? '',
      ).toUpperCase();
      if (
        /SUCCESS|SUCCEEDED|COMPLETED|DONE|OK|APPROVED/.test(status) ||
        last.success === true
      ) {
        return { ...last, commandId: input.commandId, settled: true };
      }
      if (/FAIL|ERROR|REJECT|CANCEL/.test(status) || last.success === false) {
        this.logger.warn(
          `HS catalog command ${input.commandId} ${status}: ${JSON.stringify(last).slice(0, 800)}`,
        );
        throw new ProviderHttpError(
          this.formatCatalogCommandFailure(last, status || 'error'),
          502,
          last,
          `${this.vendorBase(input.vendorId)}/catalogs/commands/${input.commandId}`,
        );
      }
      await new Promise((r) => setTimeout(r, intervalMs));
    }

    return {
      ...last,
      commandId: input.commandId,
      settled: false,
      timedOut: true,
    };
  }

  private async settleCatalogMutation(input: {
    cookies: Record<string, string>;
    vendorId: string;
    raw: unknown;
    wait?: boolean;
  }): Promise<Record<string, unknown>> {
    const raw = asRecord(input.raw);
    const commandId = this.extractCommandId(raw);
    if (!commandId || input.wait === false) {
      return { ...raw, commandId };
    }
    const settled = await this.waitForCommand({
      cookies: input.cookies,
      vendorId: input.vendorId,
      commandId,
    });
    return { ...raw, commandId, command: settled };
  }

  async createProduct(input: {
    cookies: Record<string, string>;
    vendorId: string;
    product: Record<string, unknown>;
    waitForCommand?: boolean;
  }): Promise<Record<string, unknown>> {
    const product = this.normalizeProductWritePayload(input.product);
    if (
      !asArray(product.catalogIds).length ||
      !asArray(product.categories).length
    ) {
      throw new ProviderHttpError(
        'HUNGERSTATION: catalogId و categoryId مطلوبان لإنشاء المنتج',
        400,
        product,
        'hungerstation-catalog',
      );
    }
    const unitPrice = Number(product.unitPrice ?? 0);
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
      throw new ProviderHttpError(
        'HUNGERSTATION: أدخل سعراً أكبر من صفر (unitPrice)',
        400,
        product,
        'hungerstation-catalog',
      );
    }
    this.logger.log(
      `HS createProduct payload: ${JSON.stringify({
        catalogIds: product.catalogIds,
        categories: product.categories,
        unitPrice: product.unitPrice,
        names: product.names,
        descriptions: product.descriptions,
      })}`,
    );
    try {
      const raw = await this.rest(
        input.cookies,
        `${this.vendorBase(input.vendorId)}/catalogs/products`,
        'POST',
        product,
      );
      const settled = await this.settleCatalogMutation({
        cookies: input.cookies,
        vendorId: input.vendorId,
        raw,
        wait: input.waitForCommand !== false,
      });

      const command = asRecord(settled.command ?? settled);
      const productId = String(
        command.platformItemId ??
          command.temporaryItemId ??
          settled.platformItemId ??
          '',
      ).trim();
      const nameAr = this.localeValue(product.names, ['ar-SA', 'ar']);
      const descAr = this.localeValue(product.descriptions, ['ar-SA', 'ar']);
      if (productId && nameAr) {
        try {
          const translation = await this.requestAiProductTranslation({
            cookies: input.cookies,
            vendorId: input.vendorId,
            productId,
            nameAr,
            descriptionAr: descAr || undefined,
          });
          return { ...settled, productId, translation };
        } catch (error) {
          this.logger.warn(
            `HS post-create translation skipped: ${error instanceof Error ? error.message : error}`,
          );
        }
      }
      return { ...settled, productId: productId || undefined };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.warn(`HS createProduct failed: ${msg}`);
      if (error instanceof ProviderHttpError) throw error;
      throw new ProviderHttpError(
        msg,
        502,
        { product, cause: msg },
        `${this.vendorBase(input.vendorId)}/catalogs/products`,
      );
    }
  }

  async updateProduct(input: {
    cookies: Record<string, string>;
    vendorId: string;
    productId: string;
    product: Record<string, unknown>;
    waitForCommand?: boolean;
  }) {
    const product = this.normalizeProductWritePayload(input.product);
    const url = `${this.vendorBase(input.vendorId)}/catalogs/products/${encodeURIComponent(input.productId)}`;
    let raw: unknown;
    try {
      raw = await this.rest(input.cookies, url, 'PUT', product);
    } catch (error) {
      this.logger.warn(
        `HS product PUT failed, trying PATCH: ${error instanceof Error ? error.message : error}`,
      );
      raw = await this.rest(input.cookies, url, 'PATCH', product);
    }
    return this.settleCatalogMutation({
      cookies: input.cookies,
      vendorId: input.vendorId,
      raw,
      wait: input.waitForCommand !== false,
    });
  }

  async deleteProduct(input: {
    cookies: Record<string, string>;
    vendorId: string;
    productId: string;
    waitForCommand?: boolean;
  }) {
    const raw = await this.rest(
      input.cookies,
      `${this.vendorBase(input.vendorId)}/catalogs/products/${encodeURIComponent(input.productId)}`,
      'DELETE',
    );
    return this.settleCatalogMutation({
      cookies: input.cookies,
      vendorId: input.vendorId,
      raw,
      wait: input.waitForCommand !== false,
    });
  }

  async setProductAvailability(input: {
    cookies: Record<string, string>;
    vendorId: string;
    productId: string;
    available: boolean;
    waitForCommand?: boolean;
  }) {
    const raw = await this.rest(
      input.cookies,
      `${this.vendorBase(input.vendorId)}/catalogs/products/${encodeURIComponent(input.productId)}/availability`,
      'PUT',
      {
        available: input.available,
        context: 'MENU_UPDATE',
      },
    );
    return this.settleCatalogMutation({
      cookies: input.cookies,
      vendorId: input.vendorId,
      raw,
      wait: input.waitForCommand !== false,
    });
  }

  async createCategory(input: {
    cookies: Record<string, string>;
    vendorId: string;
    catalogId: string;
    category: Record<string, unknown>;
    waitForCommand?: boolean;
  }) {
    const category = this.normalizeCategoryWritePayload(input.category);
    const raw = await this.rest(
      input.cookies,
      `${this.vendorBase(input.vendorId)}/catalogs/${encodeURIComponent(input.catalogId)}/categories`,
      'POST',
      category,
    );
    return this.settleCatalogMutation({
      cookies: input.cookies,
      vendorId: input.vendorId,
      raw,
      wait: input.waitForCommand !== false,
    });
  }

  async updateCategory(input: {
    cookies: Record<string, string>;
    vendorId: string;
    catalogId: string;
    categoryId: string;
    category: Record<string, unknown>;
    waitForCommand?: boolean;
  }) {
    const category = this.normalizeCategoryWritePayload(input.category);
    const raw = await this.rest(
      input.cookies,
      `${this.vendorBase(input.vendorId)}/catalogs/${encodeURIComponent(input.catalogId)}/categories/${encodeURIComponent(input.categoryId)}`,
      'PATCH',
      {
        ...category,
        name:
          this.localeValue(category.names, ['ar-SA', 'ar']) ||
          HungerStationClient.EN_NAME_SEED,
      },
    );
    return this.settleCatalogMutation({
      cookies: input.cookies,
      vendorId: input.vendorId,
      raw,
      wait: input.waitForCommand !== false,
    });
  }

  async deleteCategory(input: {
    cookies: Record<string, string>;
    vendorId: string;
    catalogId: string;
    categoryId: string;
    waitForCommand?: boolean;
  }) {
    const raw = await this.rest(
      input.cookies,
      `${this.vendorBase(input.vendorId)}/catalogs/${encodeURIComponent(input.catalogId)}/categories/${encodeURIComponent(input.categoryId)}`,
      'DELETE',
    );
    return this.settleCatalogMutation({
      cookies: input.cookies,
      vendorId: input.vendorId,
      raw,
      wait: input.waitForCommand !== false,
    });
  }

  private imageUploadUrl(vendorId: string, productId?: string): string {
    const base = `${HS_IMAGES_API_BASE}/${HS_GLOBAL_ENTITY_ID}/VENDOR/${encodeURIComponent(vendorId)}`;
    const qs = new URLSearchParams({ itemType: 'PRODUCT' });
    if (productId) qs.set('itemId', productId);
    return `${base}?${qs.toString()}`;
  }

  /**
   * Upload product image. Prefers extension `rest_multipart` (Phase 3);
   * falls back to direct multipart fetch.
   */
  async uploadProductImage(input: {
    cookies: Record<string, string>;
    vendorId: string;
    productId?: string;
    fileBase64: string;
    fileName?: string;
    contentType?: string;
  }) {
    const url = this.imageUploadUrl(input.vendorId, input.productId);
    const fileName = input.fileName?.trim() || 'product.jpg';
    const contentType = input.contentType?.trim() || 'image/jpeg';
    const base64 = input.fileBase64.replace(/^data:[^;]+;base64,/, '');

    if (this.bridge.isConnected('hungerstation')) {
      try {
        return asRecord(
          await this.bridge.sendCommand('hungerstation', 'rest_multipart', {
            url,
            method: 'POST',
            fileBase64: base64,
            fileName,
            contentType,
            fieldName: 'file',
          }),
        );
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        if (!/extension_|unknown.*command/i.test(msg)) {
          throw error;
        }
        this.logger.warn(`HS rest_multipart fallback to direct: ${msg}`);
      }
    }

    const buffer = Buffer.from(base64, 'base64');
    const form = new FormData();
    form.append(
      'file',
      new Blob([buffer], { type: contentType }),
      fileName,
    );

    const headers = this.gqlHeaders(input.cookies);
    delete headers['Content-Type'];
    delete headers['content-type'];

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);
    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers,
        body: form,
        signal: controller.signal,
      });
      const text = await resp.text();
      if (resp.status === 401) {
        throw new HungerStationSessionError('session_expired');
      }
      if (resp.status === 403) {
        throw new HungerStationBlockedError('perimeter_x_blocked');
      }
      let data: unknown = null;
      if (text.trim()) {
        try {
          data = JSON.parse(text);
        } catch {
          data = { raw: text };
        }
      }
      if (!resp.ok) {
        throw new ProviderHttpError(
          `HS image upload HTTP ${resp.status}`,
          resp.status,
          data,
          url,
        );
      }
      return asRecord(data);
    } finally {
      clearTimeout(timeout);
    }
  }

  async requestAiProductTranslation(input: {
    cookies: Record<string, string>;
    vendorId: string;
    productId: string;
    nameAr: string;
    descriptionAr?: string;
  }) {
    const fields: Array<{ fieldName: string; value: string }> = [];
    const nameClean = input.nameAr.trim();
    const descClean = String(input.descriptionAr ?? '').trim();
    if (nameClean.length >= 2) {
      fields.push({ fieldName: 'names', value: nameClean });
    }
    if (descClean.length >= 2) {
      fields.push({ fieldName: 'descriptions', value: descClean });
    }
    if (!fields.length) return null;

    const url = `https://vendor-api-sa.me.restaurant-partners.com/api/1/translations/${HS_GLOBAL_ENTITY_ID}/vendor/${encodeURIComponent(input.vendorId)}`;
    return asRecord(
      await this.rest(input.cookies, url, 'POST', {
        itemId: input.productId,
        itemType: 'PRODUCT',
        locale: 'ar-SA',
        translationLocales: ['en-SA'],
        fields,
      }),
    );
  }

  async requestProductTranslation(input: {
    cookies: Record<string, string>;
    vendorId: string;
    nameAr: string;
    descriptionAr?: string;
    productId?: string;
  }) {
    if (input.productId?.trim()) {
      return (
        (await this.requestAiProductTranslation({
          cookies: input.cookies,
          vendorId: input.vendorId,
          productId: input.productId.trim(),
          nameAr: input.nameAr,
          descriptionAr: input.descriptionAr,
        })) ?? {}
      );
    }
    return asRecord(
      await this.rest(
        input.cookies,
        `${HS_TRANSLATIONS_API_BASE}/${HS_GLOBAL_ENTITY_ID}/vendor/${encodeURIComponent(input.vendorId)}`,
        'POST',
        {
          sourceLocale: 'ar-SA',
          targetLocale: 'en-SA',
          texts: {
            name: input.nameAr,
            description: input.descriptionAr ?? '',
          },
          name: input.nameAr,
          description: input.descriptionAr ?? '',
        },
      ),
    );
  }

  async getMenuProducts(input: {
    cookies: Record<string, string>;
    vendorId: string;
  }) {
    const catalogs = await this.getCatalogs(input);
    const products: Record<string, unknown>[] = [];
    const categories: Record<string, unknown>[] = [];

    for (const catalogRow of catalogs) {
      const catalog = asRecord(catalogRow);
      const catalogId = String(catalog.id ?? '');
      for (const categoryRow of asArray(catalog.categories)) {
        const category = asRecord(categoryRow);
        const catId = String(category.id ?? '');
        const catName = String(category.name ?? '');
        categories.push({
          ...category,
          catalogId,
          externalId: catId,
          name: catName,
        });
        if (!catalogId || !catId) continue;
        try {
          const items = await this.getCategoryProducts({
            cookies: input.cookies,
            vendorId: input.vendorId,
            catalogId,
            categoryId: catId,
          });
          for (const p of items) {
            products.push({
              ...p,
              categoryName: catName,
              catalogId,
              catalogCategoryId: catId,
              categoryExternalId: catId,
            });
          }
        } catch (error) {
          this.logger.warn(
            `HS products fetch failed cat=${catId}: ${error instanceof Error ? error.message : error}`,
          );
        }
      }
    }

    return { products, categories };
  }

  mapOrder(row: Record<string, unknown>) {
    const billing = asRecord(row.billing);
    return {
      externalId: String(row.orderId ?? ''),
      externalNumber: String(row.orderId ?? ''),
      status: String(row.orderStatus ?? row.status ?? 'unknown'),
      financialStatus:
        row.billableStatus != null ? String(row.billableStatus) : null,
      placedAt: String(row.placedTimestamp ?? new Date().toISOString()),
      currency: 'SAR',
      subtotal: money(row.subtotal ?? row.orderValue ?? 0),
      totalAmount: money(row.subtotal ?? row.orderValue ?? 0),
      providerFee: money(billing.commissionAmount ?? 0),
      netAmount: money(billing.netRevenue ?? row.subtotal ?? 0),
      projectLocationExternalId:
        row.vendorId != null ? String(row.vendorId) : null,
      items: asArray(row.items).map((item, index) => {
        const line = asRecord(item);
        const qty = money(line.quantity ?? 1, '1');
        const unit = money(line.unitPrice ?? 0);
        return {
          externalId: String(line.id ?? index),
          name: String(line.name ?? 'Item'),
          quantity: qty,
          unitPrice: unit,
          totalAmount: money(
            line.lineItemTotal ?? Number(qty) * Number(unit),
          ),
          productExternalId: line.id != null ? String(line.id) : null,
          rawPayload: line,
        };
      }),
      rawPayload: row,
    };
  }

  mapProduct(row: Record<string, unknown>) {
    const names = asArray(row.names);
    let name = String(row.name ?? row.title ?? '');
    for (const entry of names) {
      const n = asRecord(entry);
      if (n.locale === 'ar-SA' || n.locale === 'ar') {
        name = String(n.value ?? name);
        break;
      }
    }
    return {
      externalId: String(row.id ?? ''),
      name: name || 'Product',
      description: String(row.description ?? ''),
      status:
        row.active === false || row.available === false ? 'INACTIVE' : 'ACTIVE',
      price: money(row.unitPrice ?? row.price ?? 0),
      currency: 'SAR',
      categoryExternalId:
        row.categoryExternalId != null
          ? String(row.categoryExternalId)
          : row.catalogCategoryId != null
            ? String(row.catalogCategoryId)
            : null,
      imageUrl:
        typeof row.imageUrl === 'string'
          ? row.imageUrl
          : typeof asRecord(asArray(row.imageUrls)[0]).url === 'string'
            ? String(asRecord(asArray(row.imageUrls)[0]).url)
            : null,
      rawPayload: row,
    };
  }
}

export function extractVendorId(cookies: Record<string, string>): string {
  try {
    let raw = cookies.selectedVendors || '';
    if (!raw) return '';
    if (raw.includes('%')) raw = decodeURIComponent(raw);
    const decoded = JSON.parse(raw) as { currentVendorId?: string };
    const current = decoded.currentVendorId || '';
    if (current.includes(';')) return current.split(';')[1] ?? '';
    return current;
  } catch {
    return '';
  }
}



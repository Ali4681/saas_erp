import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { CredentialPayload } from '../../effective-capability.service';
import { asRecord, money, resolveBaseUrl } from './credential-resolve';
import { providerFetch, ProviderHttpError } from './provider-http.client';

export const MADFU_BASE_DEFAULT = 'https://api.madfu.com.sa';

/** Numeric orderStatus → ERP installment status strings (mapInstallmentStatus). */
export const MADFU_STATUS_MAP: Record<number, string> = {
  124: 'PENDING',
  125: 'CAPTURED',
  135: 'FAILED',
  136: 'EXPIRED',
  140: 'REFUNDED',
  141: 'PENDING',
  142: 'PARTIALLY_REFUNDED',
  143: 'FAILED',
};

export type MadfuCredentials = {
  apiKey: string;
  appCode: string;
  basicToken: string;
  username: string;
  password: string;
  baseUrl: string;
};

@Injectable()
export class MadfuClient {
  private readonly logger = new Logger(MadfuClient.name);

  resolveCredentials(credentials: CredentialPayload): MadfuCredentials {
    const apiKey = String(
      credentials.apiKey ?? credentials.madfuApiKey ?? '',
    ).trim();
    const appCode = String(
      credentials.appCode ??
        credentials.madfuAppCode ??
        credentials.clientId ??
        '',
    ).trim();
    const basicToken = String(
      credentials.basicToken ??
        credentials.madfuBasicToken ??
        credentials.clientSecret ??
        '',
    ).trim();
    const username = String(credentials.username ?? '').trim();
    const password = String(credentials.password ?? '').trim();
    const baseUrl = resolveBaseUrl(credentials, MADFU_BASE_DEFAULT);
    return { apiKey, appCode, basicToken, username, password, baseUrl };
  }

  private baseHeaders(creds: MadfuCredentials): Record<string, string> {
    return {
      APIKey: creds.apiKey,
      AppCode: creds.appCode,
      Authorization: `Basic ${creds.basicToken}`,
      PlatformTypeId: '5',
      'Content-Type': 'application/json',
    };
  }

  authedHeaders(creds: MadfuCredentials, jwt: string): Record<string, string> {
    return {
      ...this.baseHeaders(creds),
      Token: jwt,
    };
  }

  /** Two-step auth: init token → merchant JWT. */
  async obtainJwt(creds: MadfuCredentials): Promise<string> {
    if (
      !creds.apiKey ||
      !creds.appCode ||
      !creds.basicToken ||
      !creds.username ||
      !creds.password
    ) {
      throw new ProviderHttpError(
        'MADFU: missing apiKey, appCode, basicToken, username, or password',
        401,
        null,
        creds.baseUrl,
      );
    }

    const base = this.baseHeaders(creds);
    const initRes = await providerFetch<Record<string, unknown>>({
      method: 'POST',
      url: `${creds.baseUrl}/merchants/token/init`,
      headers: base,
      body: { uuid: randomUUID(), systemInfo: 'web' },
      timeoutMs: 15_000,
      raw: true,
    });
    if (!initRes.ok) {
      throw new ProviderHttpError(
        `MADFU init failed HTTP ${initRes.status}`,
        initRes.status,
        initRes.data,
        `${creds.baseUrl}/merchants/token/init`,
      );
    }
    const initToken = String(asRecord(initRes.data).token ?? '').trim();
    if (!initToken) {
      throw new ProviderHttpError(
        'MADFU: init response missing token',
        401,
        initRes.data,
        `${creds.baseUrl}/merchants/token/init`,
      );
    }

    const loginRes = await providerFetch<Record<string, unknown>>({
      method: 'POST',
      url: `${creds.baseUrl}/Merchants/sign-in`,
      headers: { ...base, Token: initToken },
      body: { userName: creds.username, password: creds.password },
      timeoutMs: 15_000,
      raw: true,
    });
    if (!loginRes.ok) {
      throw new ProviderHttpError(
        `MADFU sign-in failed HTTP ${loginRes.status}`,
        loginRes.status,
        loginRes.data,
        `${creds.baseUrl}/Merchants/sign-in`,
      );
    }
    const jwt = String(asRecord(loginRes.data).token ?? '').trim();
    if (!jwt) {
      throw new ProviderHttpError(
        'MADFU: sign-in response missing token',
        401,
        loginRes.data,
        `${creds.baseUrl}/Merchants/sign-in`,
      );
    }
    return jwt;
  }

  async getOrderStatus(
    creds: MadfuCredentials,
    jwt: string,
    params: {
      orderId?: string;
      invoiceCode?: string;
      merchantReference?: string;
    },
  ): Promise<Record<string, unknown>> {
    const query: Record<string, string> = {};
    if (params.orderId) query.orderId = params.orderId;
    if (params.invoiceCode) query.invoiceCode = params.invoiceCode;
    if (params.merchantReference) {
      query.merchantReference = params.merchantReference;
    }
    if (!Object.keys(query).length) {
      throw new ProviderHttpError(
        'MADFU: need orderId, invoiceCode, or merchantReference',
        400,
        null,
        `${creds.baseUrl}/Merchants/Order/OrderGet_OnlinePayment`,
      );
    }

    const res = await providerFetch<Record<string, unknown>>({
      method: 'GET',
      url: `${creds.baseUrl}/Merchants/Order/OrderGet_OnlinePayment`,
      headers: this.authedHeaders(creds, jwt),
      query,
      timeoutMs: 20_000,
      raw: true,
    });
    if (!res.ok) {
      throw new ProviderHttpError(
        `MADFU status HTTP ${res.status}`,
        res.status,
        res.data,
        `${creds.baseUrl}/Merchants/Order/OrderGet_OnlinePayment`,
      );
    }
    return asRecord(res.data);
  }

  async cancel(
    creds: MadfuCredentials,
    jwt: string,
    input: { invoiceCode?: string; merchantReference?: string },
  ) {
    const res = await providerFetch({
      method: 'POST',
      url: `${creds.baseUrl}/Merchants/Order/CancelOrder_OnlinePayment`,
      headers: this.authedHeaders(creds, jwt),
      body: {
        invoiceCode: input.invoiceCode ?? '',
        merchantReference: input.merchantReference ?? '',
      },
      timeoutMs: 20_000,
      raw: true,
    });
    if (!res.ok) {
      throw new ProviderHttpError(
        `MADFU cancel HTTP ${res.status}`,
        res.status,
        res.data,
        `${creds.baseUrl}/Merchants/Order/CancelOrder_OnlinePayment`,
      );
    }
    return asRecord(res.data);
  }

  async refund(
    creds: MadfuCredentials,
    jwt: string,
    input: {
      orderId: number;
      amount: number;
      merchantReference?: string;
    },
  ) {
    const feesRes = await providerFetch<Record<string, unknown>>({
      method: 'POST',
      url: `${creds.baseUrl}/api/Refund/RefundFee/Calculate`,
      headers: this.authedHeaders(creds, jwt),
      body: { orderid: input.orderId, refundAmount: input.amount },
      timeoutMs: 20_000,
      raw: true,
    });
    const fees = feesRes.ok
      ? Number(asRecord(feesRes.data).refundFees ?? 0) || 0
      : 0;

    const res = await providerFetch({
      method: 'POST',
      url: `${creds.baseUrl}/api/Refund/Create`,
      headers: this.authedHeaders(creds, jwt),
      body: {
        orderid: input.orderId,
        refundAmount: input.amount,
        refundFees: fees,
        referenceNumber: input.merchantReference || randomUUID(),
      },
      timeoutMs: 20_000,
      raw: true,
    });
    if (!res.ok) {
      throw new ProviderHttpError(
        `MADFU refund HTTP ${res.status}`,
        res.status,
        res.data,
        `${creds.baseUrl}/api/Refund/Create`,
      );
    }
    return asRecord(res.data);
  }

  async share(
    creds: MadfuCredentials,
    jwt: string,
    input: { mobile: string; amount: number; merchantReference?: string },
  ) {
    const res = await providerFetch({
      method: 'POST',
      url: `${creds.baseUrl}/Merchants/Order/shareOrder`,
      headers: this.authedHeaders(creds, jwt),
      body: {
        mobileNumber: input.mobile,
        amount: input.amount,
        merchantReference: input.merchantReference ?? '',
      },
      timeoutMs: 20_000,
      raw: true,
    });
    if (!res.ok) {
      throw new ProviderHttpError(
        `MADFU share HTTP ${res.status}`,
        res.status,
        res.data,
        `${creds.baseUrl}/Merchants/Order/shareOrder`,
      );
    }
    return asRecord(res.data);
  }

  mapStatusCode(raw: unknown): string {
    const n = Number(raw);
    if (Number.isFinite(n) && MADFU_STATUS_MAP[n]) return MADFU_STATUS_MAP[n];
    const s = String(raw ?? '').toUpperCase();
    return s || 'UNKNOWN';
  }

  mapInstallment(
    data: Record<string, unknown>,
    fallback: {
      externalId?: string;
      merchantOrderReference?: string;
      amount?: string | number;
    } = {},
  ) {
    const nested = asRecord(data.data);
    const orderId = String(
      data.orderId ?? nested.orderId ?? fallback.externalId ?? '',
    );
    const statusRaw =
      data.orderStatus ?? nested.orderStatus ?? data.status ?? nested.status;
    const amountRaw =
      data.amount ??
      nested.amount ??
      data.orderAmount ??
      nested.orderAmount ??
      fallback.amount ??
      0;
    return {
      externalId: orderId,
      merchantOrderReference: String(
        data.merchantReference ??
          nested.merchantReference ??
          data.invoiceCode ??
          nested.invoiceCode ??
          data.invoceCode ??
          nested.invoceCode ??
          fallback.merchantOrderReference ??
          orderId,
      ),
      status: this.mapStatusCode(statusRaw),
      amount: money(amountRaw),
      currency: String(data.currency ?? nested.currency ?? 'SAR'),
      capturedAt:
        this.mapStatusCode(statusRaw) === 'CAPTURED'
          ? new Date().toISOString()
          : null,
      rawPayload: data,
    };
  }

  logWarn(message: string) {
    this.logger.warn(message);
  }
}

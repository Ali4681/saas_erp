import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { MirrorInstallmentInput } from '../../mirrors/mirror-upsert.service';
import type { CredentialPayload } from '../../effective-capability.service';
import { BaseProviderAdapter } from './base.adapter';
import {
  asArray,
  asRecord,
  money,
  resolveAccessToken,
  resolveBaseUrl,
} from './credential-resolve';
import {
  bearerHeaders,
  providerFetch,
  ProviderHttpError,
} from './provider-http.client';
import type {
  AdapterAuthContext,
  AdapterOperationContext,
  AdapterOperationResult,
  AdapterSyncContext,
  AdapterSyncResult,
  AdapterWebhookContext,
  AdapterWebhookResult,
} from './adapter.types';

const STATUS_MAP: Record<string, string> = {
  AUTHORIZED: 'AUTHORIZED',
  CLOSED: 'CAPTURED',
  REJECTED: 'FAILED',
  EXPIRED: 'EXPIRED',
  CREATED: 'PENDING',
  CANCELLED: 'CANCELLED',
  CANCELED: 'CANCELLED',
  REFUNDED: 'REFUNDED',
};

@Injectable()
export class TabbyProviderAdapter extends BaseProviderAdapter {
  readonly providerCode = 'TABBY';

  private config(ctx: AdapterAuthContext) {
    const token = resolveAccessToken(ctx.credentials);
    const baseUrl = resolveBaseUrl(ctx.credentials, 'https://api.tabby.sa');
    if (!token) {
      throw new ProviderHttpError(
        'TABBY: missing apiKey/accessToken (secret key)',
        401,
        null,
        baseUrl,
      );
    }
    return { token, baseUrl };
  }

  private mapStatus(raw: unknown): string {
    const key = String(raw ?? '').toUpperCase();
    return STATUS_MAP[key] ?? (key || 'PENDING');
  }

  async testAuth(ctx: AdapterAuthContext): Promise<boolean> {
    const { token, baseUrl } = this.config(ctx);
    const res = await providerFetch({
      url: `${baseUrl}/api/v2/payments`,
      headers: bearerHeaders(token),
      query: { limit: 1, offset: 0 },
      timeoutMs: 20_000,
      raw: true,
    });
    return res.ok;
  }

  async syncEntity(ctx: AdapterSyncContext): Promise<AdapterSyncResult> {
    const entity = ctx.entityType.toLowerCase();
    if (entity !== 'installment' && entity !== 'payment') {
      return { items: [], nextCursor: null, hasMore: false };
    }

    const { token, baseUrl } = this.config(ctx);
    const offset = Math.max(0, Number(ctx.cursor ?? '0') || 0);
    const limit = 20;
    const res = await providerFetch<Record<string, unknown>>({
      url: `${baseUrl}/api/v2/payments`,
      headers: bearerHeaders(token),
      query: { limit, offset },
      timeoutMs: 30_000,
    });

    const payments = asArray(res.data.payments ?? res.data);
    const installments: MirrorInstallmentInput[] = payments.map((row) => {
      const p = asRecord(row);
      const order = asRecord(p.order);
      const buyer = asRecord(p.buyer);
      return {
        externalId: String(p.id ?? ''),
        merchantOrderReference: String(
          order.reference_id ?? p.merchant_code ?? p.id ?? '',
        ),
        externalCustomerReference:
          buyer.id != null
            ? String(buyer.id)
            : buyer.phone != null
              ? String(buyer.phone)
              : null,
        status: this.mapStatus(p.status),
        amount: money(p.amount),
        currency: String(p.currency ?? 'SAR'),
        capturedAt:
          String(p.status).toUpperCase() === 'CLOSED'
            ? ((p.created_at as string) ?? null)
            : null,
        rawPayload: p,
      };
    });

    const pagination = asRecord(res.data.pagination);
    const total = Number(pagination.total_count ?? 0);
    const nextOffset = offset + limit;
    const hasMore = nextOffset < total || payments.length === limit;

    return {
      items: [],
      installments: installments.filter((i) => i.externalId),
      nextCursor: hasMore ? String(nextOffset) : null,
      hasMore,
    };
  }

  async executeOperation(
    ctx: AdapterOperationContext,
  ): Promise<AdapterOperationResult> {
    const { token, baseUrl } = this.config(ctx);
    const paymentId = ctx.externalTargetId;
    if (!paymentId) {
      throw new ProviderHttpError(
        'TABBY: externalTargetId (payment id) required',
        400,
        null,
        baseUrl,
      );
    }

    const amount = Number(ctx.payload.amount ?? 0);
    const op = ctx.operationType.toUpperCase();

    if (op.includes('CAPTURE') || ctx.capabilityCode.includes('CAPTURE')) {
      const res = await providerFetch({
        method: 'POST',
        url: `${baseUrl}/api/v2/payments/${paymentId}/captures`,
        headers: bearerHeaders(token, { 'Content-Type': 'application/json' }),
        body: {
          amount: String(amount),
          reference_id: String(ctx.payload.reference_id ?? randomUUID()),
        },
      });
      return {
        responseExternalId: paymentId,
        rawResponse: asRecord(res.data),
      };
    }

    if (op.includes('REFUND') || ctx.capabilityCode.includes('REFUND')) {
      const res = await providerFetch({
        method: 'POST',
        url: `${baseUrl}/api/v2/payments/${paymentId}/refunds`,
        headers: bearerHeaders(token, { 'Content-Type': 'application/json' }),
        body: {
          amount: String(amount),
          reference_id: String(ctx.payload.reference_id ?? randomUUID()),
        },
      });
      return {
        responseExternalId: paymentId,
        rawResponse: asRecord(res.data),
      };
    }

    if (op.includes('CLOSE') || op.includes('CANCEL')) {
      const res = await providerFetch({
        method: 'POST',
        url: `${baseUrl}/api/v2/payments/${paymentId}/close`,
        headers: bearerHeaders(token, { 'Content-Type': 'application/json' }),
      });
      return {
        responseExternalId: paymentId,
        rawResponse: asRecord(res.data),
      };
    }

    throw new ProviderHttpError(
      `TABBY: unsupported operation ${ctx.operationType}`,
      400,
      null,
      baseUrl,
    );
  }

  verifyWebhookSignature(input: {
    rawBody: string;
    signatureHeader: string | undefined;
    credentials: CredentialPayload;
  }): boolean {
    const secret =
      (typeof input.credentials.webhookSecret === 'string' &&
        input.credentials.webhookSecret) ||
      resolveAccessToken(input.credentials);
    if (!secret || !input.signatureHeader) return false;
    const digest = createHmac('sha256', secret)
      .update(input.rawBody)
      .digest('hex');
    const a = Buffer.from(digest);
    const b = Buffer.from(input.signatureHeader.replace(/^sha256=/i, ''));
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  }

  async processWebhook(
    ctx: AdapterWebhookContext,
  ): Promise<AdapterWebhookResult> {
    const payload = asRecord(ctx.payload);
    const payment = asRecord(
      payload.payment ?? payload.data ?? payload.resource ?? payload,
    );
    const externalId = String(payment.id ?? '');
    if (!externalId) {
      return { ignored: true, reason: 'No payment id in Tabby webhook' };
    }
    const order = asRecord(payment.order);
    return {
      entityType: 'installment',
      installments: [
        {
          externalId,
          merchantOrderReference: String(
            order.reference_id ?? payment.id ?? '',
          ),
          status: this.mapStatus(payment.status),
          amount: money(payment.amount),
          currency: String(payment.currency ?? 'SAR'),
          rawPayload: payment,
        },
      ],
    };
  }
}

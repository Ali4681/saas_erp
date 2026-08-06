import { createHmac, timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { CredentialPayload } from '../../effective-capability.service';
import { BaseProviderAdapter } from './base.adapter';
import {
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

@Injectable()
export class TamaraProviderAdapter extends BaseProviderAdapter {
  readonly providerCode = 'TAMARA';

  private config(ctx: AdapterAuthContext) {
    const token = resolveAccessToken(ctx.credentials);
    const baseUrl = resolveBaseUrl(ctx.credentials, 'https://api.tamara.co');
    if (!token) {
      throw new ProviderHttpError(
        'TAMARA: missing apiKey/accessToken',
        401,
        null,
        baseUrl,
      );
    }
    return { token, baseUrl };
  }

  async testAuth(ctx: AdapterAuthContext): Promise<boolean> {
    const { token, baseUrl } = this.config(ctx);
    // Tamara has no simple list-all; validate token shape via a lightweight call.
    // Authorise with a fake id returns 404/400 when auth is valid, 401 when not.
    const res = await providerFetch({
      method: 'POST',
      url: `${baseUrl}/orders/00000000-0000-0000-0000-000000000000/authorise`,
      headers: bearerHeaders(token, { 'Content-Type': 'application/json' }),
      timeoutMs: 15_000,
      raw: true,
    });
    return res.status !== 401 && res.status !== 403;
  }

  async syncEntity(_ctx: AdapterSyncContext): Promise<AdapterSyncResult> {
    // Tamara merchant API is primarily webhook/event driven for payment state.
    return {
      items: [],
      installments: [],
      nextCursor: null,
      hasMore: false,
    };
  }

  async executeOperation(
    ctx: AdapterOperationContext,
  ): Promise<AdapterOperationResult> {
    const { token, baseUrl } = this.config(ctx);
    const orderId = ctx.externalTargetId;
    if (!orderId) {
      throw new ProviderHttpError(
        'TAMARA: externalTargetId (order id) required',
        400,
        null,
        baseUrl,
      );
    }

    const amount = Number(ctx.payload.amount ?? 0);
    const currency = String(ctx.payload.currency ?? 'SAR');
    const op = ctx.operationType.toUpperCase();
    const headers = bearerHeaders(token, { 'Content-Type': 'application/json' });

    if (op.includes('AUTHORISE') || op.includes('AUTHORIZE')) {
      const res = await providerFetch({
        method: 'POST',
        url: `${baseUrl}/orders/${orderId}/authorise`,
        headers,
      });
      return {
        responseExternalId: orderId,
        rawResponse: asRecord(res.data),
      };
    }

    if (op.includes('CAPTURE')) {
      const res = await providerFetch({
        method: 'POST',
        url: `${baseUrl}/payments/capture`,
        headers,
        body: {
          order_id: orderId,
          total_amount: { amount: Number(amount.toFixed(2)), currency },
          shipping_info: {
            shipped_at: new Date().toISOString(),
            shipping_company: String(ctx.payload.shipping_company ?? 'Other'),
          },
        },
      });
      return {
        responseExternalId: orderId,
        rawResponse: asRecord(res.data),
      };
    }

    if (op.includes('CANCEL')) {
      let res = await providerFetch({
        method: 'POST',
        url: `${baseUrl}/orders/${orderId}/cancel`,
        headers,
        body: {
          total_amount: { amount: Number(amount.toFixed(2)), currency },
        },
        raw: true,
      });
      if (res.status === 404) {
        res = await providerFetch({
          method: 'POST',
          url: `${baseUrl}/payments/cancel`,
          headers,
          body: {
            order_id: orderId,
            total_amount: { amount: Number(amount.toFixed(2)), currency },
          },
        });
      } else if (!res.ok) {
        throw new ProviderHttpError(
          `TAMARA cancel HTTP ${res.status}`,
          res.status,
          res.data,
          `${baseUrl}/orders/${orderId}/cancel`,
        );
      }
      return {
        responseExternalId: orderId,
        rawResponse: asRecord(res.data),
      };
    }

    if (op.includes('REFUND')) {
      const res = await providerFetch({
        method: 'POST',
        url: `${baseUrl}/payments/simplified-refund/${orderId}`,
        headers,
        body: {
          total_amount: { amount: Number(amount.toFixed(2)), currency },
          comment: String(ctx.payload.comment ?? 'Refund'),
        },
      });
      return {
        responseExternalId: orderId,
        rawResponse: asRecord(res.data),
      };
    }

    throw new ProviderHttpError(
      `TAMARA: unsupported operation ${ctx.operationType}`,
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
    const order = asRecord(
      payload.order ?? payload.data ?? payload.resource ?? payload,
    );
    const externalId = String(order.order_id ?? order.id ?? '');
    if (!externalId) {
      return { ignored: true, reason: 'No order id in Tamara webhook' };
    }

    const event = String(ctx.eventType ?? payload.event_type ?? '').toLowerCase();
    let status = String(order.status ?? 'PENDING').toUpperCase();
    if (event.includes('approved') || event.includes('authoris')) {
      status = 'AUTHORIZED';
    } else if (event.includes('captured')) {
      status = 'CAPTURED';
    } else if (event.includes('declined') || event.includes('expired')) {
      status = 'FAILED';
    } else if (event.includes('canceled') || event.includes('cancelled')) {
      status = 'CANCELLED';
    } else if (event.includes('refund')) {
      status = 'REFUNDED';
    }

    const total = asRecord(order.total_amount);
    return {
      entityType: 'installment',
      installments: [
        {
          externalId,
          merchantOrderReference: String(
            order.order_reference_id ?? order.order_number ?? externalId,
          ),
          status,
          amount: money(total.amount ?? order.total_amount ?? 0),
          currency: String(total.currency ?? order.currency ?? 'SAR'),
          authorizedAt: event.includes('approved')
            ? new Date().toISOString()
            : null,
          capturedAt: event.includes('captured')
            ? new Date().toISOString()
            : null,
          rawPayload: order,
        },
      ],
    };
  }
}

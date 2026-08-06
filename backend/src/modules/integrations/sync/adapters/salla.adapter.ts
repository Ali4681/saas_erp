import { Injectable } from '@nestjs/common';
import type { MirrorProductInput } from '../../mirrors/mirror-upsert.service';
import { BaseProviderAdapter } from './base.adapter';
import {
  asArray,
  asRecord,
  bilingualName,
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
export class SallaProviderAdapter extends BaseProviderAdapter {
  readonly providerCode = 'SALLA';

  private config(ctx: AdapterAuthContext) {
    const token = resolveAccessToken(ctx.credentials);
    const baseUrl = resolveBaseUrl(
      ctx.credentials,
      'https://api.salla.dev/admin/v2',
    );
    if (!token) {
      throw new ProviderHttpError(
        'SALLA: missing accessToken/apiKey',
        401,
        null,
        baseUrl,
      );
    }
    return { token, baseUrl };
  }

  async testAuth(ctx: AdapterAuthContext): Promise<boolean> {
    const { token, baseUrl } = this.config(ctx);
    const res = await providerFetch({
      url: `${baseUrl}/products`,
      headers: bearerHeaders(token),
      query: { page: 1, per_page: 1 },
      timeoutMs: 20_000,
      raw: true,
    });
    return res.ok;
  }

  async syncEntity(ctx: AdapterSyncContext): Promise<AdapterSyncResult> {
    const entity = ctx.entityType.toLowerCase();
    if (entity === 'product') return this.syncProducts(ctx);
    return { items: [], nextCursor: null, hasMore: false };
  }

  private async syncProducts(
    ctx: AdapterSyncContext,
  ): Promise<AdapterSyncResult> {
    const { token, baseUrl } = this.config(ctx);
    const page = Math.max(1, Number(ctx.cursor ?? '1') || 1);
    const res = await providerFetch<Record<string, unknown>>({
      url: `${baseUrl}/products`,
      headers: bearerHeaders(token),
      query: { page, per_page: 50 },
      timeoutMs: 60_000,
    });

    const rows = asArray(res.data.data ?? res.data);
    const products: MirrorProductInput[] = rows.map((row) => {
      const p = asRecord(row);
      const priceObj = asRecord(p.price);
      const statusRaw = String(p.status ?? 'sale').toLowerCase();
      return {
        externalId: String(p.id ?? ''),
        name: bilingualName(p.name),
        sku: p.sku != null ? String(p.sku) : null,
        description:
          typeof p.description === 'string' ? p.description : null,
        status: statusRaw === 'sale' || statusRaw === 'active' ? 'ACTIVE' : 'INACTIVE',
        price: money(priceObj.amount ?? p.price),
        currency: String(priceObj.currency ?? 'SAR'),
        imageUrl:
          typeof asRecord(asArray(p.images)[0]).url === 'string'
            ? String(asRecord(asArray(p.images)[0]).url)
            : null,
        rawPayload: p,
      };
    });

    const pagination = asRecord(res.data.pagination);
    const current = Number(pagination.currentPage ?? page);
    const total = Number(pagination.totalPages ?? current);
    const nextUrl = asRecord(pagination.urls).next;
    const hasMore =
      (typeof nextUrl === 'string' && Boolean(nextUrl)) || current < total;

    return {
      items: [],
      products: products.filter((p) => p.externalId),
      nextCursor: hasMore ? String(current + 1) : null,
      hasMore,
    };
  }

  async executeOperation(
    ctx: AdapterOperationContext,
  ): Promise<AdapterOperationResult> {
    const { token, baseUrl } = this.config(ctx);
    if (
      ctx.operationType === 'PRODUCT_UPDATE' ||
      ctx.capabilityCode === 'PRODUCT_UPDATE'
    ) {
      const id = ctx.externalTargetId;
      if (!id) {
        throw new ProviderHttpError(
          'SALLA: externalTargetId required',
          400,
          null,
          baseUrl,
        );
      }
      const res = await providerFetch({
        method: 'PUT',
        url: `${baseUrl}/products/${id}`,
        headers: bearerHeaders(token, {
          'Content-Type': 'application/json',
        }),
        body: ctx.payload,
        timeoutMs: 30_000,
      });
      return {
        responseExternalId: id,
        rawResponse: asRecord(res.data),
      };
    }

    throw new ProviderHttpError(
      `SALLA: unsupported operation ${ctx.operationType}`,
      400,
      null,
      baseUrl,
    );
  }

  async processWebhook(
    ctx: AdapterWebhookContext,
  ): Promise<AdapterWebhookResult> {
    const payload = asRecord(ctx.payload);
    const data = asRecord(payload.data ?? payload);
    const event = String(payload.event ?? ctx.eventType ?? '').toLowerCase();

    if (event.includes('product')) {
      const externalId = String(data.id ?? '');
      if (!externalId) {
        return { ignored: true, reason: 'No product id in Salla webhook' };
      }
      return {
        entityType: 'product',
        products: [
          {
            externalId,
            name: bilingualName(data.name),
            sku: data.sku != null ? String(data.sku) : null,
            price: money(asRecord(data.price).amount ?? data.price),
            status: 'ACTIVE',
            rawPayload: data,
          },
        ],
      };
    }

    if (event.includes('order')) {
      const externalId = String(data.id ?? '');
      if (!externalId) {
        return { ignored: true, reason: 'No order id in Salla webhook' };
      }
      return {
        entityType: 'order',
        orders: [
          {
            externalId,
            externalNumber:
              data.reference_id != null
                ? String(data.reference_id)
                : externalId,
            status: String(
              asRecord(data.status).slug ??
                asRecord(data.status).name ??
                'unknown',
            ),
            totalAmount: money(
              asRecord(data.amounts).total ?? data.total ?? 0,
            ),
            currency: 'SAR',
            placedAt: (data.date as string) ?? new Date().toISOString(),
            rawPayload: data,
          },
        ],
      };
    }

    return { ignored: true, reason: `Unhandled Salla event: ${event}` };
  }
}

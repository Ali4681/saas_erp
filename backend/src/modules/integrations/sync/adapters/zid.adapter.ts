import { Injectable } from '@nestjs/common';
import type {
  MirrorOrderInput,
  MirrorProductInput,
} from '../../mirrors/mirror-upsert.service';
import { BaseProviderAdapter } from './base.adapter';
import {
  asArray,
  asRecord,
  bilingualName,
  money,
  resolveAccessToken,
  resolveBaseUrl,
  resolveStoreId,
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
export class ZidProviderAdapter extends BaseProviderAdapter {
  readonly providerCode = 'ZID';

  private config(ctx: AdapterAuthContext) {
    const token = resolveAccessToken(ctx.credentials);
    const storeId = resolveStoreId(ctx.credentials);
    const baseUrl = resolveBaseUrl(ctx.credentials, 'https://api.zid.sa/v1');
    if (!token) {
      throw new ProviderHttpError(
        'ZID: missing apiKey/accessToken (manager token)',
        401,
        null,
        baseUrl,
      );
    }
    return { token, storeId, baseUrl };
  }

  private headers(token: string, storeId: string, managerOnly = false) {
    const headers: Record<string, string> = {
      'X-Manager-Token': token,
      Role: 'Manager',
      Accept: 'application/json',
      'Accept-Language': 'ar',
      ...(storeId ? { 'Store-Id': storeId } : {}),
    };
    if (!managerOnly) {
      Object.assign(headers, bearerHeaders(token));
    }
    return headers;
  }

  async testAuth(ctx: AdapterAuthContext): Promise<boolean> {
    const { token, storeId, baseUrl } = this.config(ctx);
    const res = await providerFetch({
      url: `${baseUrl}/products/`,
      headers: this.headers(token, storeId),
      query: { page: 1, page_size: 1 },
      timeoutMs: 20_000,
      raw: true,
    });
    if (res.ok) return true;
    // Manager endpoint fallback
    const mgr = await providerFetch({
      url: `${baseUrl}/managers/store/categories`,
      headers: this.headers(token, storeId, true),
      timeoutMs: 20_000,
      raw: true,
    });
    return mgr.ok;
  }

  async syncEntity(ctx: AdapterSyncContext): Promise<AdapterSyncResult> {
    const entity = ctx.entityType.toLowerCase();
    if (entity === 'product') return this.syncProducts(ctx);
    if (entity === 'category') return this.syncCategories(ctx);
    if (entity === 'order') return this.syncOrders(ctx);
    return { items: [], nextCursor: null, hasMore: false };
  }

  private async syncProducts(
    ctx: AdapterSyncContext,
  ): Promise<AdapterSyncResult> {
    const { token, storeId, baseUrl } = this.config(ctx);
    const page = ctx.cursor ? Number(ctx.cursor) : 1;
    const url =
      page > 1 && ctx.cursor?.startsWith('http')
        ? ctx.cursor
        : `${baseUrl}/products/`;

    const res = await providerFetch<Record<string, unknown>>({
      url,
      headers: this.headers(token, storeId),
      query: ctx.cursor?.startsWith('http')
        ? undefined
        : { page: Number.isFinite(page) && page > 0 ? page : 1 },
      timeoutMs: 60_000,
    });

    const rows = asArray(res.data.results ?? res.data.products ?? res.data);
    const products: MirrorProductInput[] = rows.map((row) => {
      const p = asRecord(row);
      const images = asArray(p.images ?? p.images_list);
      const firstImage = asRecord(images[0]);
      const imageUrl =
        (typeof firstImage.image === 'object'
          ? bilingualName(
              asRecord(firstImage.image).thumbnail ??
                asRecord(firstImage.image).full_size,
              '',
            )
          : null) ||
        (typeof firstImage.url === 'string' ? firstImage.url : null) ||
        (typeof p.image === 'string' ? p.image : null);

      return {
        externalId: String(p.id ?? p.uuid ?? ''),
        name: bilingualName(p.name),
        sku: p.sku != null ? String(p.sku) : null,
        description: bilingualName(
          p.short_description ?? p.description ?? '',
          '',
        ),
        status: p.is_published === false ? 'INACTIVE' : 'ACTIVE',
        price: money(p.price ?? p.sale_price),
        currency: 'SAR',
        imageUrl,
        categoryExternalId: (() => {
          const cats = asArray(p.categories);
          const first = asRecord(cats[0]);
          return first.id != null ? String(first.id) : null;
        })(),
        rawPayload: p,
      };
    });

    const next =
      typeof res.data.next === 'string' && res.data.next
        ? String(res.data.next).replace(/^http:\/\//, 'https://')
        : null;

    return {
      items: [],
      products: products.filter((p) => p.externalId),
      nextCursor: next,
      hasMore: Boolean(next),
    };
  }

  private async syncCategories(
    ctx: AdapterSyncContext,
  ): Promise<AdapterSyncResult> {
    const { token, storeId, baseUrl } = this.config(ctx);
    const res = await providerFetch<Record<string, unknown>>({
      url: `${baseUrl}/managers/store/categories`,
      headers: this.headers(token, storeId, true),
      timeoutMs: 30_000,
    });
    const rows = asArray(res.data.categories ?? res.data);
    const categories = rows
      .map((row) => {
        const c = asRecord(row);
        return {
          externalId: String(c.id ?? ''),
          name: bilingualName(c.name),
          parentExternalId: c.parent_id != null ? String(c.parent_id) : null,
          status: c.is_published === false ? 'INACTIVE' : 'ACTIVE',
          rawPayload: c,
        };
      })
      .filter((c) => c.externalId);

    return {
      items: [],
      categories,
      nextCursor: null,
      hasMore: false,
    };
  }

  private async syncOrders(
    ctx: AdapterSyncContext,
  ): Promise<AdapterSyncResult> {
    const { token, storeId, baseUrl } = this.config(ctx);
    const page = Math.max(1, Number(ctx.cursor ?? '1') || 1);
    let res = await providerFetch<Record<string, unknown>>({
      url: `${baseUrl}/managers/store/orders`,
      headers: this.headers(token, storeId),
      query: { page, per_page: 20, payload_type: 'simple' },
      timeoutMs: 60_000,
      raw: true,
    });
    if (res.status === 401 || res.status === 403) {
      res = await providerFetch<Record<string, unknown>>({
        url: `${baseUrl}/managers/store/orders`,
        headers: this.headers(token, storeId, true),
        query: { page, per_page: 20, payload_type: 'simple' },
        timeoutMs: 60_000,
      });
    } else if (!res.ok) {
      throw new ProviderHttpError(
        `ZID orders HTTP ${res.status}`,
        res.status,
        res.data,
        `${baseUrl}/managers/store/orders`,
      );
    }

    const data = asRecord(res.data);
    const rows = asArray(
      data.orders ?? data.results ?? data.data ?? data,
    );
    const orders: MirrorOrderInput[] = rows.map((row) => {
      const o = asRecord(row);
      const customer = asRecord(o.customer ?? o.consignee);
      const status =
        typeof o.order_status === 'object'
          ? bilingualName(asRecord(o.order_status).name ?? asRecord(o.order_status).code, 'unknown')
          : String(o.order_status ?? o.status ?? 'unknown');

      const items = asArray(o.products ?? o.items ?? o.order_products).map(
        (item, index) => {
          const line = asRecord(item);
          const qty = money(line.quantity ?? 1, '1');
          const unit = money(line.price ?? line.unit_price ?? 0);
          const total = money(
            line.total ?? Number(qty) * Number(unit),
            String(Number(qty) * Number(unit)),
          );
          return {
            externalId: String(line.id ?? line.product_id ?? index),
            name: bilingualName(line.name ?? line.product_name),
            sku: line.sku != null ? String(line.sku) : null,
            quantity: qty,
            unitPrice: unit,
            totalAmount: total,
            productExternalId:
              line.product_id != null ? String(line.product_id) : null,
            rawPayload: line,
          };
        },
      );

      return {
        externalId: String(o.id ?? o.order_id ?? ''),
        externalNumber: o.code != null ? String(o.code) : String(o.id ?? ''),
        status,
        financialStatus:
          o.payment_status != null ? String(o.payment_status) : null,
        placedAt: (o.created_at as string) ?? (o.order_date as string) ?? new Date().toISOString(),
        currency: String(o.currency ?? 'SAR'),
        subtotal: money(o.products_price ?? o.subtotal ?? o.total),
        discountAmount: money(o.discount ?? o.discount_amount ?? 0),
        taxAmount: money(o.tax ?? o.tax_amount ?? 0),
        deliveryFee: money(o.shipping ?? o.shipping_price ?? 0),
        totalAmount: money(o.total ?? o.order_total ?? 0),
        paymentMethod:
          o.payment_method != null ? String(o.payment_method) : null,
        customerExternalId:
          customer.id != null ? String(customer.id) : null,
        items,
        rawPayload: o,
      };
    });

    const totalPages = Number(
      asRecord(data.pagination).total_pages ??
        asRecord(data.meta).last_page ??
        page,
    );
    const hasMore = page < totalPages;

    return {
      items: [],
      orders: orders.filter((o) => o.externalId),
      nextCursor: hasMore ? String(page + 1) : null,
      hasMore,
    };
  }

  async executeOperation(
    ctx: AdapterOperationContext,
  ): Promise<AdapterOperationResult> {
    const { token, storeId, baseUrl } = this.config(ctx);
    const orderId = ctx.externalTargetId;
    if (!orderId) {
      throw new ProviderHttpError(
        'ZID operation requires externalTargetId',
        400,
        null,
        baseUrl,
      );
    }

    if (
      ctx.operationType === 'ORDER_STATUS_UPDATE' ||
      ctx.capabilityCode === 'ORDER_STATUS_UPDATE' ||
      ctx.capabilityCode === 'ORDER_UPDATE'
    ) {
      const status = String(
        ctx.payload.order_status ?? ctx.payload.status ?? '',
      );
      if (!status) {
        throw new ProviderHttpError(
          'ZID: payload.order_status is required',
          400,
          null,
          baseUrl,
        );
      }
      const body = new URLSearchParams();
      body.set('order_status', status);
      if (ctx.payload.inventory_address_id) {
        body.set(
          'inventory_address_id',
          String(ctx.payload.inventory_address_id),
        );
      }
      const res = await providerFetch({
        method: 'POST',
        url: `${baseUrl}/managers/store/orders/${orderId}/change-order-status`,
        headers: {
          ...this.headers(token, storeId),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
        timeoutMs: 30_000,
      });
      return {
        responseExternalId: orderId,
        rawResponse: asRecord(res.data),
      };
    }

    throw new ProviderHttpError(
      `ZID: unsupported operation ${ctx.operationType}`,
      400,
      null,
      baseUrl,
    );
  }

  async processWebhook(
    ctx: AdapterWebhookContext,
  ): Promise<AdapterWebhookResult> {
    const payload = asRecord(ctx.payload);
    const order = asRecord(
      payload.order ?? payload.data ?? payload.resource ?? payload,
    );
    const externalId = String(order.id ?? order.order_id ?? '');
    if (!externalId) {
      return { ignored: true, reason: 'No order id in Zid webhook payload' };
    }

    const status =
      typeof order.order_status === 'object'
        ? bilingualName(asRecord(order.order_status).name, 'unknown')
        : String(order.order_status ?? order.status ?? ctx.eventType);

    return {
      entityType: 'order',
      orders: [
        {
          externalId,
          externalNumber: order.code != null ? String(order.code) : externalId,
          status,
          totalAmount: money(order.total ?? order.order_total ?? 0),
          currency: String(order.currency ?? 'SAR'),
          placedAt:
            (order.created_at as string) ?? new Date().toISOString(),
          rawPayload: order,
        },
      ],
    };
  }
}

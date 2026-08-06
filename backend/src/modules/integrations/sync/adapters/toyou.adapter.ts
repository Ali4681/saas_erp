import { Injectable } from '@nestjs/common';
import { BaseProviderAdapter } from './base.adapter';
import { asArray, asRecord } from './credential-resolve';
import { ProviderHttpError } from './provider-http.client';
import { ToYouClient } from './toyou.client';
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
export class ToYouProviderAdapter extends BaseProviderAdapter {
  readonly providerCode = 'TOYOU';

  constructor(private readonly client: ToYouClient) {
    super();
  }

  private token(ctx: AdapterAuthContext): string {
    const token = this.client.resolveToken(ctx.credentials);
    if (!token) {
      throw new ProviderHttpError(
        'TOYOU: missing accessToken (JWT from merchant.toyou.io)',
        401,
        null,
        'toyou',
      );
    }
    return token;
  }

  async testAuth(ctx: AdapterAuthContext): Promise<boolean> {
    const token = this.client.resolveToken(ctx.credentials);
    if (!token) return false;
    return this.client.verifyToken(token);
  }

  async syncEntity(ctx: AdapterSyncContext): Promise<AdapterSyncResult> {
    const entity = ctx.entityType.toLowerCase();
    if (entity === 'order') return this.syncOrders(ctx);
    if (entity === 'product') return this.syncProducts(ctx);
    if (entity === 'category') return this.syncCategories(ctx);
    return { items: [], nextCursor: null, hasMore: false };
  }

  private async syncOrders(
    ctx: AdapterSyncContext,
  ): Promise<AdapterSyncResult> {
    const token = this.token(ctx);
    const page = Math.max(0, Number(ctx.cursor || 0) || 0);
    const raw = await this.client.listOrders(token, page, 50);
    const content = asArray(raw.content ?? raw.orders ?? raw.data);
    const orders = content
      .map((row) => this.client.mapOrder(asRecord(row)))
      .filter((o) => o.externalId);
    const totalPages = Number(raw.totalPages ?? 0);
    const hasMore =
      totalPages > 0 ? page + 1 < totalPages : content.length >= 50;
    return {
      items: [],
      orders,
      nextCursor: hasMore ? String(page + 1) : null,
      hasMore,
    };
  }

  private async syncProducts(
    ctx: AdapterSyncContext,
  ): Promise<AdapterSyncResult> {
    const token = this.token(ctx);
    const page = Math.max(0, Number(ctx.cursor || 0) || 0);
    const raw = await this.client.listProducts(token, page, 50);
    const content = asArray(raw.content ?? raw.products ?? raw.data);
    const products = content
      .map((row) => this.client.mapProduct(asRecord(row)))
      .filter((p) => p.externalId);
    const totalPages = Number(raw.totalPages ?? 0);
    const hasMore =
      totalPages > 0 ? page + 1 < totalPages : content.length >= 50;
    return {
      items: [],
      products,
      nextCursor: hasMore ? String(page + 1) : null,
      hasMore,
    };
  }

  private async syncCategories(
    ctx: AdapterSyncContext,
  ): Promise<AdapterSyncResult> {
    const token = this.token(ctx);
    const groups = await this.client.listGroups(token);
    return {
      items: [],
      categories: groups
        .map((row) => this.client.mapCategory(asRecord(row)))
        .filter((c) => c.externalId),
      nextCursor: null,
      hasMore: false,
    };
  }

  async executeOperation(
    ctx: AdapterOperationContext,
  ): Promise<AdapterOperationResult> {
    throw new ProviderHttpError(
      `TOYOU: unsupported operation ${ctx.operationType} (Phase 3 sync-only)`,
      400,
      null,
      'toyou',
    );
  }

  async processWebhook(
    ctx: AdapterWebhookContext,
  ): Promise<AdapterWebhookResult> {
    const payload = asRecord(ctx.payload);
    const order = asRecord(payload.order ?? payload.data ?? payload);
    const externalId = String(
      order.id ?? order.orderId ?? order.orderNumber ?? '',
    );
    if (!externalId) {
      return { ignored: true, reason: 'No order id in ToYou webhook' };
    }
    return {
      entityType: 'order',
      orders: [this.client.mapOrder({ ...order, id: externalId })],
    };
  }
}

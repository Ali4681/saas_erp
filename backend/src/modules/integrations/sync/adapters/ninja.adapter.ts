import { Injectable } from '@nestjs/common';
import { BaseProviderAdapter } from './base.adapter';
import { asRecord } from './credential-resolve';
import { NinjaClient } from './ninja.client';
import { ProviderHttpError } from './provider-http.client';
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
export class NinjaProviderAdapter extends BaseProviderAdapter {
  readonly providerCode = 'NINJA';

  constructor(private readonly client: NinjaClient) {
    super();
  }

  private session(ctx: AdapterAuthContext) {
    const session = this.client.resolveSession(ctx.credentials);
    if (!session.token) {
      throw new ProviderHttpError(
        'NINJA: missing accessToken',
        401,
        null,
        'ninja',
      );
    }
    if (!session.restaurantId || !session.branchId) {
      throw new ProviderHttpError(
        'NINJA: missing vendorId (restaurantId) and/or branchId',
        400,
        null,
        'ninja',
      );
    }
    return session;
  }

  async testAuth(ctx: AdapterAuthContext): Promise<boolean> {
    const token = this.client.resolveSession(ctx.credentials).token;
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
    const session = this.session(ctx);
    const page = Math.max(1, Number(ctx.cursor || 1) || 1);
    const result = await this.client.listOrders(session, page, 50);
    const orders = result.items
      .map((row) => this.client.mapOrder(asRecord(row)))
      .filter((o) => o.externalId);
    const total = Number(result.meta.total ?? orders.length);
    const hasMore = page * 50 < total;
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
    const session = this.session(ctx);
    if (!session.menuId) {
      throw new ProviderHttpError(
        'NINJA: missing menuId in credentials (required for product sync)',
        400,
        null,
        'ninja',
      );
    }
    const page = Math.max(1, Number(ctx.cursor || 1) || 1);
    const result = await this.client.listProducts(session, page, 50);
    const products = result.items
      .map((row) => this.client.mapProduct(asRecord(row)))
      .filter((p) => p.externalId);
    const total = Number(result.meta.total ?? products.length);
    const hasMore = page * 50 < total;
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
    const session = this.session(ctx);
    if (!session.menuId) {
      throw new ProviderHttpError(
        'NINJA: missing menuId in credentials (required for category sync)',
        400,
        null,
        'ninja',
      );
    }
    const rows = await this.client.listCategories(session);
    return {
      items: [],
      categories: rows
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
      `NINJA: unsupported operation ${ctx.operationType} (Phase 3 sync-only; availability ops in Phase 5)`,
      400,
      null,
      'ninja',
    );
  }

  async processWebhook(
    ctx: AdapterWebhookContext,
  ): Promise<AdapterWebhookResult> {
    const payload = asRecord(ctx.payload);
    const data = asRecord(payload.data ?? payload);
    const externalId = String(data.id ?? '');
    if (!externalId) {
      return { ignored: true, reason: 'No order id in Ninja webhook' };
    }
    return {
      entityType: 'order',
      orders: [this.client.mapOrder(data)],
    };
  }
}

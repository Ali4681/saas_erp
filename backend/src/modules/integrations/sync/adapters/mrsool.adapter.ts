import { Injectable } from '@nestjs/common';
import { ExtensionBridgeService } from '../../extension/extension-bridge.service';
import { BaseProviderAdapter } from './base.adapter';
import { asRecord } from './credential-resolve';
import { MrsoolClient } from './mrsool.client';
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
export class MrsoolProviderAdapter extends BaseProviderAdapter {
  readonly providerCode = 'MRSOOL';

  constructor(
    private readonly client: MrsoolClient,
    private readonly bridge: ExtensionBridgeService,
  ) {
    super();
  }

  async testAuth(_ctx: AdapterAuthContext): Promise<boolean> {
    if (!this.bridge.isConnected('mrsool')) return false;
    return this.client.testAuth();
  }

  async syncEntity(ctx: AdapterSyncContext): Promise<AdapterSyncResult> {
    const entity = ctx.entityType.toLowerCase();
    if (entity === 'order') return this.syncOrders(ctx);
    if (entity === 'product') return this.syncProducts(ctx);
    if (entity === 'category') return this.syncCategories();
    return { items: [], nextCursor: null, hasMore: false };
  }

  private async syncOrders(
    ctx: AdapterSyncContext,
  ): Promise<AdapterSyncResult> {
    const page = Math.max(1, Number(ctx.cursor || 1) || 1);
    const raw = await this.client.listOrders(page);
    const orders = this.client
      .listFrom(raw)
      .map((row) => this.client.mapOrder(asRecord(row)))
      .filter((o) => o.externalId);
    const next = this.client.nextPage(raw, page);
    return {
      items: [],
      orders,
      nextCursor: next != null ? String(next) : null,
      hasMore: next != null,
    };
  }

  private async syncProducts(
    ctx: AdapterSyncContext,
  ): Promise<AdapterSyncResult> {
    const page = Math.max(1, Number(ctx.cursor || 1) || 1);
    const branchId = this.client.resolveBranchId(ctx.credentials);
    const raw = await this.client.listMenu(
      page,
      branchId ? [branchId] : undefined,
    );
    const products = this.client
      .listFrom(raw)
      .map((row) => this.client.mapProduct(asRecord(row)))
      .filter((p) => p.externalId);
    const next = this.client.nextPage(raw, page);
    return {
      items: [],
      products,
      nextCursor: next != null ? String(next) : null,
      hasMore: next != null,
    };
  }

  private async syncCategories(): Promise<AdapterSyncResult> {
    const raw = await this.client.listCategories();
    return {
      items: [],
      categories: this.client
        .listFrom(raw)
        .map((row) => this.client.mapCategory(asRecord(row)))
        .filter((c) => c.externalId),
      nextCursor: null,
      hasMore: false,
    };
  }

  async executeOperation(
    ctx: AdapterOperationContext,
  ): Promise<AdapterOperationResult> {
    const op = ctx.operationType.toUpperCase();
    const id = ctx.externalTargetId;
    if (!id) {
      throw new ProviderHttpError(
        'MRSOOL: externalTargetId required',
        400,
        null,
        'mrsool',
      );
    }

    if (op.includes('ENABLE') || op.includes('AVAILABLE')) {
      const data = asRecord(
        await this.client.rest(
          `/v1/menu_items/${id}/enable_menu_item`,
          'PUT',
          { for_all_branches: true },
        ),
      );
      return { responseExternalId: id, rawResponse: data };
    }
    if (op.includes('DISABLE') || op.includes('UNAVAILABLE')) {
      const data = asRecord(
        await this.client.rest(
          `/v1/menu_items/${id}/disable_menu_item`,
          'PUT',
        ),
      );
      return { responseExternalId: id, rawResponse: data };
    }

    throw new ProviderHttpError(
      `MRSOOL: unsupported operation ${ctx.operationType}`,
      400,
      { extensionConnected: this.bridge.isConnected('mrsool') },
      'mrsool',
    );
  }

  async processWebhook(
    ctx: AdapterWebhookContext,
  ): Promise<AdapterWebhookResult> {
    const payload = asRecord(ctx.payload);
    const order = asRecord(payload.order ?? payload.data ?? payload);
    const externalId = String(order.id ?? '');
    if (!externalId) {
      return { ignored: true, reason: 'No order id in Mrsool webhook' };
    }
    return {
      entityType: 'order',
      orders: [this.client.mapOrder({ ...order, id: externalId })],
    };
  }
}

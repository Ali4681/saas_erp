import { Injectable, Logger } from '@nestjs/common';
import type { CredentialPayload } from '../../effective-capability.service';
import { ExtensionBridgeService } from '../../extension/extension-bridge.service';
import { asArray, asRecord, money } from './credential-resolve';
import { ProviderHttpError } from './provider-http.client';

@Injectable()
export class MrsoolClient {
  private readonly logger = new Logger(MrsoolClient.name);
  private readonly channel = 'mrsool';

  constructor(private readonly bridge: ExtensionBridgeService) {}

  ensureBridge() {
    if (!this.bridge.isConnected(this.channel)) {
      throw new ProviderHttpError(
        'MRSOOL: browser extension not connected — open business.mrsool.co and connect ws://HOST:3000/ws/mrsool',
        503,
        { extensionConnected: false },
        'mrsool',
      );
    }
  }

  resolveBranchId(credentials: CredentialPayload): string {
    return String(
      credentials.vendorId ??
        credentials.branchId ??
        credentials.merchantId ??
        '',
    ).trim();
  }

  async rest(
    path: string,
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'GET',
    body?: unknown,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    this.ensureBridge();
    try {
      return await this.bridge.sendCommand(
        this.channel,
        'mrsool_rest',
        {
          path,
          method,
          body: body ?? null,
          params: params ?? null,
        },
        45_000,
      );
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('extension_not_connected')) {
        throw new ProviderHttpError(msg, 503, null, path);
      }
      if (/unauthor|mrsool_unauthorized/i.test(msg)) {
        throw new ProviderHttpError(msg, 401, null, path);
      }
      throw new ProviderHttpError(msg, 502, null, path);
    }
  }

  async testAuth(): Promise<boolean> {
    try {
      await this.rest('/v1/business_accounts/show_associated_business', 'GET');
      return true;
    } catch (error) {
      this.logger.warn(
        `Mrsool testAuth failed: ${error instanceof Error ? error.message : error}`,
      );
      return false;
    }
  }

  async listOrders(page = 1) {
    return asRecord(
      await this.rest(
        '/v1/business_orders/admin_user_without_items_orders',
        'GET',
        null,
        { page: String(page) },
      ),
    );
  }

  async listMenu(page = 1, branchIds?: string[]) {
    const params: Record<string, unknown> = { page: String(page) };
    if (branchIds?.length) {
      params['business_branch_ids[]'] = branchIds;
    }
    return asRecord(
      await this.rest('/v1/menu_items/without_details', 'GET', null, params),
    );
  }

  async listCategories() {
    return asRecord(
      await this.rest(
        '/v1/menus/categories/fetch_available_categories',
        'GET',
      ),
    );
  }

  private extractList(raw: Record<string, unknown>): unknown[] {
    return asArray(
      raw.data ?? raw.items ?? raw.menu_items ?? raw.orders ?? raw.results,
    );
  }

  mapOrder(row: Record<string, unknown>) {
    return {
      externalId: String(row.id ?? ''),
      externalNumber: String(row.order_id ?? row.id ?? ''),
      status: String(row.status ?? 'unknown'),
      placedAt: String(
        row.received_at ?? row.created_at ?? new Date().toISOString(),
      ),
      currency: 'SAR',
      subtotal: money(row.grand_total ?? row.total ?? 0),
      totalAmount: money(row.grand_total ?? row.total ?? 0),
      paymentMethod:
        row.order_type != null ? String(row.order_type) : null,
      projectLocationExternalId:
        row.business_branch_id != null
          ? String(row.business_branch_id)
          : null,
      rawPayload: row,
    };
  }

  mapProduct(row: Record<string, unknown>) {
    const cats = asArray(row.menu_categories_ids ?? row.menu_category_ids);
    const disabledPct = Number(
      row.menu_item_disabled_branches_percentage ?? 0,
    );
    return {
      externalId: String(row.id ?? ''),
      name: String(row.name || row.en_name || 'Product'),
      description: String(row.short_desc ?? row.en_short_desc ?? ''),
      status: disabledPct >= 100 ? 'INACTIVE' : 'ACTIVE',
      price: money(row.price ?? 0),
      currency: 'SAR',
      categoryExternalId: cats[0] != null ? String(cats[0]) : null,
      imageUrl: typeof row.photo_url === 'string' ? row.photo_url : null,
      rawPayload: row,
    };
  }

  mapCategory(row: Record<string, unknown>) {
    return {
      externalId: String(row.id ?? ''),
      name: String(row.name || row.en_name || 'Category'),
      rawPayload: row,
    };
  }

  listFrom(raw: Record<string, unknown>) {
    return this.extractList(raw);
  }

  nextPage(raw: Record<string, unknown>, currentPage: number): number | null {
    const pagination = asRecord(raw.pagination ?? raw.meta);
    const next = pagination.next_page ?? pagination.nextPage;
    if (next != null && Number(next) > currentPage) return Number(next);
    const totalPages = Number(
      pagination.total_pages ?? pagination.totalPages ?? 0,
    );
    if (totalPages > 0 && currentPage < totalPages) return currentPage + 1;
    return null;
  }
}

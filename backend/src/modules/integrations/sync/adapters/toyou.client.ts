import { Injectable, Logger } from '@nestjs/common';
import type { CredentialPayload } from '../../effective-capability.service';
import {
  asArray,
  asRecord,
  bilingualName,
  money,
  resolveAccessToken,
} from './credential-resolve';
import { providerFetch, ProviderHttpError } from './provider-http.client';

export const TOYOU_API = 'https://toyou.delivery';
export const TOYOU_ORIGIN = 'https://merchant.toyou.io';

@Injectable()
export class ToYouClient {
  private readonly logger = new Logger(ToYouClient.name);

  resolveToken(credentials: CredentialPayload): string {
    return resolveAccessToken(credentials);
  }

  decodeMerchantId(token: string): string {
    try {
      const payload = token.split('.')[1];
      if (!payload) return '';
      const padded = payload + '='.repeat((4 - (payload.length % 4)) % 4);
      const json = Buffer.from(padded, 'base64url').toString('utf8');
      const data = JSON.parse(json) as Record<string, unknown>;
      return String(data['merchant-id'] ?? data.merchantId ?? '');
    } catch {
      return '';
    }
  }

  private headers(token: string): Record<string, string> {
    return {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      Origin: TOYOU_ORIGIN,
      Referer: `${TOYOU_ORIGIN}/`,
    };
  }

  async get(
    token: string,
    path: string,
    query?: Record<string, string | number | boolean | undefined | null>,
  ): Promise<unknown> {
    const res = await providerFetch({
      method: 'GET',
      url: `${TOYOU_API}${path}`,
      headers: this.headers(token),
      query,
      timeoutMs: 30_000,
      raw: true,
    });
    if (res.status === 401) {
      throw new ProviderHttpError('TOYOU: token expired', 401, res.data, path);
    }
    if (!res.ok) {
      throw new ProviderHttpError(
        `TOYOU HTTP ${res.status}`,
        res.status,
        res.data,
        path,
      );
    }
    return res.data;
  }

  async verifyToken(token: string): Promise<boolean> {
    try {
      await this.get(token, '/merchantmenu/v1/groups');
      return true;
    } catch (error) {
      this.logger.warn(
        `ToYou verify failed: ${error instanceof Error ? error.message : error}`,
      );
      return false;
    }
  }

  async listProducts(token: string, page = 0, size = 50) {
    return asRecord(
      await this.get(token, '/merchantmenu/v1/products', { page, size }),
    );
  }

  async listGroups(token: string) {
    const data = await this.get(token, '/merchantmenu/v1/groups');
    if (Array.isArray(data)) return data;
    const rec = asRecord(data);
    return asArray(rec.content ?? rec.groups ?? rec.data);
  }

  async listOrders(token: string, page = 0, size = 50) {
    const now = Math.floor(Date.now() / 1000);
    const from = now - 7 * 24 * 60 * 60;
    return asRecord(
      await this.get(token, '/delivery/v1/merchant/orders', {
        fromDate: from,
        toDate: now,
        page,
        size,
        sort: 'creationDate,desc',
      }),
    );
  }

  private localize(value: unknown, fallback = ''): string {
    if (typeof value === 'string') return value;
    return bilingualName(value, fallback);
  }

  private toIso(value: unknown): string {
    if (value == null || value === '') return new Date().toISOString();
    if (typeof value === 'string' && value.includes('T')) return value;
    const n = Number(value);
    if (!Number.isFinite(n)) return new Date().toISOString();
    const ms = n > 1e12 ? n : n * 1000;
    return new Date(ms).toISOString();
  }

  private normalizePrice(value: unknown): string {
    const n = Number(value ?? 0);
    if (!Number.isFinite(n)) return '0';
    // create responses sometimes return halalas
    if (Number.isInteger(n) && Math.abs(n) >= 1000) return money(n / 100);
    return money(n);
  }

  mapOrder(row: Record<string, unknown>) {
    const lines = asArray(row.orderLines ?? row.items ?? row.lines);
    return {
      externalId: String(
        row.id ??
          row.orderId ??
          row.orderNumber ??
          row.displayableOrderNumber ??
          '',
      ),
      externalNumber: String(
        row.displayableOrderNumber ?? row.orderNumber ?? row.id ?? '',
      ),
      status: String(
        row.state ?? row.merchantOrderStatus ?? row.status ?? 'unknown',
      ),
      placedAt: this.toIso(row.creationDate ?? row.createdAt ?? row.created),
      currency: String(row.currency ?? 'SAR'),
      subtotal: money(row.orderCost ?? row.totalPrice ?? row.grandTotal ?? 0),
      totalAmount: money(
        row.orderCost ?? row.totalPrice ?? row.grandTotal ?? 0,
      ),
      items: lines.map((line, index) => {
        const item = asRecord(line);
        const qty = money(item.quantity ?? 1, '1');
        const unit = money(item.unitPrice ?? item.price ?? 0);
        return {
          externalId: String(item.id ?? index),
          name: this.localize(item.name ?? item.names, 'Item'),
          quantity: qty,
          unitPrice: unit,
          totalAmount: money(
            item.totalPrice ?? item.lineTotal ?? Number(qty) * Number(unit),
          ),
          productExternalId:
            item.productId != null ? String(item.productId) : null,
          rawPayload: item,
        };
      }),
      rawPayload: row,
    };
  }

  mapProduct(row: Record<string, unknown>) {
    const media = asArray(row.mediaResources);
    const firstMedia = asRecord(media[0]);
    const groupIds = asArray(row.groupIds);
    return {
      externalId: String(row.id ?? ''),
      name: this.localize(row.names ?? row.name, 'Product'),
      description: this.localize(
        row.shortDescriptions ?? row.descriptions ?? row.description,
        '',
      ),
      status: row.enabled === false ? 'INACTIVE' : 'ACTIVE',
      price: this.normalizePrice(row.price),
      currency: 'SAR',
      categoryExternalId: groupIds[0] != null ? String(groupIds[0]) : null,
      imageUrl:
        typeof row.imageUrl === 'string'
          ? row.imageUrl
          : typeof firstMedia.url === 'string'
            ? String(firstMedia.url)
            : null,
      rawPayload: row,
    };
  }

  mapCategory(row: Record<string, unknown>) {
    return {
      externalId: String(row.id ?? ''),
      name: this.localize(row.names ?? row.name, 'Category'),
      rawPayload: row,
    };
  }
}

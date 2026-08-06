import { Injectable, Logger } from '@nestjs/common';
import type { CredentialPayload } from '../../effective-capability.service';
import {
  asArray,
  asRecord,
  money,
  resolveAccessToken,
} from './credential-resolve';
import { providerFetch, ProviderHttpError } from './provider-http.client';

export const NINJA_API_BASE = 'https://admin.ananinja.com';
export const NINJA_ORIGIN = 'https://restaurant-portal.ananinja.com';

export type NinjaSession = {
  token: string;
  restaurantId: string;
  branchId: string;
  menuId: string;
};

@Injectable()
export class NinjaClient {
  private readonly logger = new Logger(NinjaClient.name);

  resolveSession(credentials: CredentialPayload): NinjaSession {
    const token = resolveAccessToken(credentials);
    const restaurantId = String(
      credentials.vendorId ??
        credentials.restaurantId ??
        credentials.merchantId ??
        '',
    ).trim();
    const branchId = String(
      credentials.branchId ?? credentials.projectLocationExternalId ?? '',
    ).trim();
    const menuId = String(credentials.menuId ?? '').trim();
    return { token, restaurantId, branchId, menuId };
  }

  private headers(token: string): Record<string, string> {
    return {
      Accept: '*/*',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      Origin: NINJA_ORIGIN,
      Referer: `${NINJA_ORIGIN}/`,
    };
  }

  async get<T = unknown>(
    token: string,
    path: string,
    query?: Record<string, string | number | boolean | undefined | null>,
  ): Promise<T> {
    const res = await providerFetch<T>({
      method: 'GET',
      url: `${NINJA_API_BASE}${path}`,
      headers: this.headers(token),
      query,
      timeoutMs: 30_000,
      raw: true,
    });
    if (res.status === 401) {
      throw new ProviderHttpError('NINJA: unauthorized', 401, res.data, path);
    }
    if (!res.ok) {
      throw new ProviderHttpError(
        `NINJA HTTP ${res.status}`,
        res.status,
        res.data,
        path,
      );
    }
    return res.data;
  }

  async verifyToken(token: string): Promise<boolean> {
    try {
      await this.get(token, '/users/me');
      return true;
    } catch (error) {
      this.logger.warn(
        `Ninja verify failed: ${error instanceof Error ? error.message : error}`,
      );
      return false;
    }
  }

  async listOrders(session: NinjaSession, page = 1, perPage = 50) {
    const filter = `branchId==${session.branchId};restaurantId==${session.restaurantId}`;
    const raw = asRecord(
      await this.get(session.token, '/restaurants/orders', {
        filter,
        'page[number]': page,
        'page[size]': perPage,
        sort: '-id',
      }),
    );
    return {
      items: asArray(raw.data),
      meta: asRecord(raw.meta),
    };
  }

  async listProducts(session: NinjaSession, page = 1, perPage = 50) {
    const filter = `menuId==${session.menuId}`;
    const raw = asRecord(
      await this.get(session.token, '/restaurants/products', {
        filter,
        'page[number]': page,
        'page[size]': perPage,
        sort: '-id',
      }),
    );
    return {
      items: asArray(raw.data),
      meta: asRecord(raw.meta),
    };
  }

  async listCategories(session: NinjaSession) {
    const filter = `menuId==${session.menuId}`;
    const raw = asRecord(
      await this.get(session.token, '/restaurants/categories', {
        filter,
        'page[number]': 1,
        'page[size]': 100,
        sort: '-id',
      }),
    );
    return asArray(raw.data);
  }

  mapOrder(item: Record<string, unknown>) {
    const attrs = asRecord(item.attributes);
    const totalCents = Number(attrs.totalAmountCents ?? 0);
    return {
      externalId: String(item.id ?? ''),
      externalNumber: String(
        attrs.externalId ?? attrs.ordersReferenceId ?? item.id ?? '',
      ),
      status: String(attrs.status ?? 'unknown'),
      placedAt: String(attrs.createdAt ?? new Date().toISOString()),
      currency: String(attrs.currency ?? 'SAR'),
      subtotal: money(totalCents / 100),
      totalAmount: money(totalCents / 100),
      projectLocationExternalId:
        attrs.branchId != null ? String(attrs.branchId) : null,
      rawPayload: item,
    };
  }

  mapProduct(item: Record<string, unknown>) {
    const attrs = asRecord(item.attributes);
    const images = asArray(attrs.imageUrls);
    const firstImage = asRecord(images[0]);
    return {
      externalId: String(item.id ?? ''),
      name: String(attrs.nameAr || attrs.nameEn || 'Product'),
      description: String(attrs.descriptionAr ?? attrs.descriptionEn ?? ''),
      status:
        attrs.enabled === false || attrs.available === false
          ? 'INACTIVE'
          : 'ACTIVE',
      price: money(attrs.priceWithVat ?? attrs.price ?? 0),
      currency: 'SAR',
      categoryExternalId:
        attrs.categoryId != null ? String(attrs.categoryId) : null,
      imageUrl:
        typeof attrs.imageUrl === 'string'
          ? attrs.imageUrl
          : typeof firstImage.url === 'string'
            ? String(firstImage.url)
            : typeof images[0] === 'string'
              ? String(images[0])
              : null,
      rawPayload: item,
    };
  }

  mapCategory(item: Record<string, unknown>) {
    const attrs = asRecord(item.attributes);
    return {
      externalId: String(item.id ?? ''),
      name: String(attrs.nameAr || attrs.nameEn || 'Category'),
      rawPayload: item,
    };
  }
}

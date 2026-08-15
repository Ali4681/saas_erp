import { Injectable } from '@nestjs/common';
import { BaseProviderAdapter } from './base.adapter';
import {
  HungerStationBlockedError,
  HungerStationClient,
  HungerStationSessionError,
} from './hungerstation.client';
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
import { asArray, asRecord } from './credential-resolve';
import { ExtensionBridgeService } from '../../extension/extension-bridge.service';

@Injectable()
export class HungerStationProviderAdapter extends BaseProviderAdapter {
  readonly providerCode = 'HUNGERSTATION';

  constructor(
    private readonly client: HungerStationClient,
    private readonly bridge: ExtensionBridgeService,
  ) {
    super();
  }

  private session(ctx: AdapterAuthContext) {
    const cookies = this.client.resolveCookies(ctx.credentials);
    const vendorId = this.client.resolveVendorId(ctx.credentials, cookies);
    if (!cookies.accessToken) {
      throw new ProviderHttpError(
        'HUNGERSTATION: missing accessToken/cookies',
        401,
        null,
        'hungerstation',
      );
    }
    if (!vendorId) {
      throw new ProviderHttpError(
        'HUNGERSTATION: missing vendorId (set vendorId or selectedVendors cookie)',
        400,
        null,
        'hungerstation',
      );
    }
    return { cookies, vendorId };
  }

  async testAuth(ctx: AdapterAuthContext): Promise<boolean> {
    try {
      const cookies = this.client.resolveCookies(ctx.credentials);
      if (!cookies.accessToken) return false;
      return this.client.validateSession(cookies);
    } catch {
      return false;
    }
  }

  async syncEntity(ctx: AdapterSyncContext): Promise<AdapterSyncResult> {
    const entity = ctx.entityType.toLowerCase();
    try {
      if (entity === 'order') return this.syncOrders(ctx);
      if (entity === 'product' || entity === 'category') {
        return this.syncMenu(ctx, entity);
      }
      return { items: [], nextCursor: null, hasMore: false };
    } catch (error) {
      if (
        error instanceof HungerStationBlockedError ||
        error instanceof HungerStationSessionError
      ) {
        throw new ProviderHttpError(
          error.message,
          error instanceof HungerStationBlockedError ? 403 : 401,
          {
            extensionConnected: this.bridge.isConnected('hungerstation'),
          },
          'hungerstation',
        );
      }
      throw error;
    }
  }

  private async syncOrders(
    ctx: AdapterSyncContext,
  ): Promise<AdapterSyncResult> {
    const { cookies, vendorId } = this.session(ctx);
    const page = await this.client.listOrders({
      cookies,
      vendorId,
      pageSize: 50,
      daysBack: 14,
      nextPageToken: ctx.cursor,
    });
    const rows = Array.isArray(page.orders) ? page.orders : [];
    const orders = rows
      .map((row) => this.client.mapOrder(asRecord(row)))
      .filter((o) => o.externalId);
    const next =
      typeof page.nextPageToken === 'string' && page.nextPageToken
        ? page.nextPageToken
        : null;
    return {
      items: [],
      orders,
      nextCursor: next,
      hasMore: Boolean(next),
    };
  }

  private async syncMenu(
    ctx: AdapterSyncContext,
    entity: string,
  ): Promise<AdapterSyncResult> {
    const { cookies, vendorId } = this.session(ctx);
    if (!this.bridge.isConnected('hungerstation')) {
      try {
        const menu = await this.client.getMenuProducts({ cookies, vendorId });
        if (entity === 'category') {
          return {
            items: [],
            categories: menu.categories
              .map((c) => ({
                externalId: String(c.externalId ?? c.id ?? ''),
                name: String(c.name ?? 'Category'),
                rawPayload: c,
              }))
              .filter((c) => c.externalId),
            nextCursor: null,
            hasMore: false,
          };
        }
        return {
          items: [],
          products: menu.products
            .map((p) => this.client.mapProduct(p))
            .filter((p) => p.externalId),
          nextCursor: null,
          hasMore: false,
        };
      } catch (error) {
        throw new ProviderHttpError(
          `HUNGERSTATION menu sync requires browser extension when portal blocks server IP (${error instanceof Error ? error.message : 'blocked'}). Connect extension to ws://HOST:PORT/ws/hungerstation`,
          503,
          { extensionConnected: false },
          'hungerstation',
        );
      }
    }

    const menu = await this.client.getMenuProducts({ cookies, vendorId });
    if (entity === 'category') {
      return {
        items: [],
        categories: menu.categories
          .map((c) => ({
            externalId: String(c.externalId ?? c.id ?? ''),
            name: String(c.name ?? 'Category'),
            rawPayload: c,
          }))
          .filter((c) => c.externalId),
        nextCursor: null,
        hasMore: false,
      };
    }
    return {
      items: [],
      products: menu.products
        .map((p) => this.client.mapProduct(p))
        .filter((p) => p.externalId),
      nextCursor: null,
      hasMore: false,
    };
  }

  async executeOperation(
    ctx: AdapterOperationContext,
  ): Promise<AdapterOperationResult> {
    const capability = ctx.capabilityCode.toUpperCase();
    const operation = ctx.operationType.toUpperCase();

    try {
      if (capability.includes('ORDER') || operation.includes('ORDER')) {
        return await this.executeOrderOperation(ctx, capability, operation);
      }

      if (
        capability === 'REPORT_READ' ||
        operation === 'REPORT_READ' ||
        operation.startsWith('REPORT_')
      ) {
        return await this.executeReportRead(ctx);
      }

      if (
        capability === 'SETTLEMENT_READ' ||
        operation === 'SETTLEMENT_READ' ||
        operation === 'LIST_PAYOUTS'
      ) {
        return await this.executeSettlementRead(ctx);
      }

      if (
        capability === 'PRODUCT_CREATE' ||
        capability === 'PRODUCT_UPDATE' ||
        capability === 'PRODUCT_READ' ||
        operation.startsWith('PRODUCT_')
      ) {
        return await this.executeProductOperation(ctx, capability, operation);
      }

      if (
        capability === 'CATEGORY_WRITE' ||
        capability === 'CATEGORY_READ' ||
        operation.startsWith('CATEGORY_')
      ) {
        return await this.executeCategoryOperation(ctx, capability, operation);
      }

      if (
        capability === 'LOCATION_READ' ||
        capability === 'LOCATION_UPDATE' ||
        capability === 'LOCATION_STATUS_UPDATE' ||
        operation.startsWith('LOCATION_') ||
        operation === 'SET_AVAILABILITY' ||
        operation === 'OPENING_TIMES'
      ) {
        return await this.executeLocationOperation(ctx, capability, operation);
      }

      if (capability === 'ACCOUNT_READ' || operation === 'ACCOUNT_READ') {
        return await this.executeAccountRead(ctx);
      }

      throw new ProviderHttpError(
        `HUNGERSTATION: unsupported operation ${ctx.operationType}`,
        400,
        { extensionConnected: this.bridge.isConnected('hungerstation') },
        'hungerstation',
      );
    } catch (error) {
      if (
        error instanceof HungerStationBlockedError ||
        error instanceof HungerStationSessionError
      ) {
        throw new ProviderHttpError(
          error.message,
          error instanceof HungerStationBlockedError ? 403 : 401,
          {
            extensionConnected: this.bridge.isConnected('hungerstation'),
          },
          'hungerstation',
        );
      }
      throw error;
    }
  }

  private async executeOrderOperation(
    ctx: AdapterOperationContext,
    capability: string,
    operation: string,
  ): Promise<AdapterOperationResult> {
    const action = this.payloadKind(ctx);
    const orderId =
      ctx.externalTargetId?.trim() ||
      String(ctx.payload.orderId ?? ctx.payload.id ?? '').trim();

    if (
      capability === 'ORDER_READ' ||
      operation === 'ORDER_READ' ||
      operation === 'GET_ORDER' ||
      action === 'list' ||
      action === 'orders'
    ) {
      const { cookies, vendorId } = this.session(ctx);

      if (
        action === 'list' ||
        action === 'orders' ||
        (!orderId &&
          (capability === 'ORDER_READ' || operation === 'ORDER_READ'))
      ) {
        const pageSize =
          typeof ctx.payload.pageSize === 'number'
            ? ctx.payload.pageSize
            : Number(ctx.payload.pageSize ?? 50) || 50;
        const daysBack =
          typeof ctx.payload.daysBack === 'number'
            ? ctx.payload.daysBack
            : Number(ctx.payload.daysBack ?? 14) || 14;
        const page = await this.client.listOrders({
          cookies,
          vendorId,
          pageSize,
          daysBack,
          nextPageToken:
            typeof ctx.payload.nextPageToken === 'string'
              ? ctx.payload.nextPageToken
              : null,
        });
        const rows = Array.isArray(page.orders) ? page.orders : [];
        const orders = rows
          .map((row) => this.client.mapOrder(asRecord(row)))
          .filter((o) => o.externalId);
        return {
          responseExternalId: vendorId,
          rawResponse: {
            orders,
            nextPageToken: page.nextPageToken ?? null,
            resultTimestamp: page.resultTimestamp ?? null,
            count: orders.length,
          },
        };
      }

      if (!orderId) {
        throw new ProviderHttpError(
          'HUNGERSTATION: externalTargetId (order id) required',
          400,
          null,
          'hungerstation',
        );
      }

      const detail = await this.client.getOrderDetail({
        cookies,
        vendorId,
        orderId,
      });
      return { responseExternalId: orderId, rawResponse: detail };
    }

    throw new ProviderHttpError(
      'HUNGERSTATION: قبول/إرسال/إلغاء الطلبات غير مدعوم عبر جلسة الإكستنشن حالياً. استخدم المزامنة فقط.',
      400,
      { extensionConnected: this.bridge.isConnected('hungerstation') },
      'hungerstation',
    );
  }

  private payloadKind(ctx: AdapterOperationContext): string {
    return String(ctx.payload.kind ?? ctx.payload.action ?? '')
      .trim()
      .toLowerCase();
  }

  private async executeReportRead(
    ctx: AdapterOperationContext,
  ): Promise<AdapterOperationResult> {
    const { cookies, vendorId } = this.session(ctx);
    const kind = this.payloadKind(ctx) || 'insights';
    const timeFrom = ctx.payload.timeFrom ?? ctx.payload.from;
    const timeTo = ctx.payload.timeTo ?? ctx.payload.to;
    const daysBack =
      typeof ctx.payload.daysBack === 'number'
        ? ctx.payload.daysBack
        : Number(ctx.payload.daysBack ?? 7) || 7;
    const granularity = String(
      ctx.payload.granularity ?? 'DAY',
    ).toUpperCase() as 'HOUR' | 'DAY' | 'MONTH';

    const range = {
      cookies,
      vendorId,
      timeFrom: timeFrom != null ? String(timeFrom) : undefined,
      timeTo: timeTo != null ? String(timeTo) : undefined,
      daysBack,
    };

    if (kind === 'performance') {
      const raw = await this.client.getPerformanceReport(range);
      return { responseExternalId: vendorId, rawResponse: raw };
    }
    if (kind === 'sales') {
      const raw = await this.client.salesOverviewByTime({
        ...range,
        granularity,
      });
      return { responseExternalId: vendorId, rawResponse: raw };
    }
    if (kind === 'ops_health' || kind === 'ops') {
      const raw = await this.client.opsHealth(range);
      return { responseExternalId: vendorId, rawResponse: raw };
    }
    if (kind === 'today_issues' || kind === 'issues') {
      const raw = await this.client.todayIssues({ cookies, vendorId });
      return { responseExternalId: vendorId, rawResponse: raw };
    }
    if (kind === 'reviews') {
      const raw = await this.client.latestReviews({
        cookies,
        vendorId,
        pageSize: Number(ctx.payload.pageSize ?? 20) || 20,
      });
      return { responseExternalId: vendorId, rawResponse: raw };
    }

    // Default: bundle for hub reports tab
    const [performance, sales, opsHealth, todayIssues, reviews] =
      await Promise.all([
        this.client.getPerformanceReport(range).catch((e) => ({
          error: e instanceof Error ? e.message : String(e),
        })),
        this.client
          .salesOverviewByTime({ ...range, granularity })
          .catch((e) => ({
            error: e instanceof Error ? e.message : String(e),
          })),
        this.client.opsHealth(range).catch((e) => ({
          error: e instanceof Error ? e.message : String(e),
        })),
        this.client.todayIssues({ cookies, vendorId }).catch((e) => ({
          error: e instanceof Error ? e.message : String(e),
        })),
        this.client
          .latestReviews({ cookies, vendorId, pageSize: 10 })
          .catch((e) => ({
            error: e instanceof Error ? e.message : String(e),
          })),
      ]);

    return {
      responseExternalId: vendorId,
      rawResponse: {
        kind: 'insights',
        performance,
        sales,
        opsHealth,
        todayIssues,
        reviews,
      },
    };
  }

  private async executeSettlementRead(
    ctx: AdapterOperationContext,
  ): Promise<AdapterOperationResult> {
    const { cookies, vendorId } = this.session(ctx);
    const raw = await this.client.listPayouts({
      cookies,
      vendorId,
      pageSize: Number(ctx.payload.pageSize ?? 20) || 20,
      nextPageToken:
        typeof ctx.payload.nextPageToken === 'string'
          ? ctx.payload.nextPageToken
          : null,
    });
    return { responseExternalId: vendorId, rawResponse: raw };
  }

  private async executeAccountRead(
    ctx: AdapterOperationContext,
  ): Promise<AdapterOperationResult> {
    const { cookies, vendorId } = this.session(ctx);
    const valid = await this.client.validateSession(cookies);
    const catalogs = await this.client
      .getCatalogs({ cookies, vendorId })
      .catch((e) => ({
        error: e instanceof Error ? e.message : String(e),
      }));
    return {
      responseExternalId: vendorId,
      rawResponse: {
        sessionValid: valid,
        vendorId,
        extensionConnected: this.bridge.isConnected('hungerstation'),
        catalogs,
      },
    };
  }

  private async executeProductOperation(
    ctx: AdapterOperationContext,
    capability: string,
    operation: string,
  ): Promise<AdapterOperationResult> {
    const { cookies, vendorId } = this.session(ctx);
    const action = this.payloadKind(ctx);
    const productId =
      ctx.externalTargetId?.trim() ||
      String(ctx.payload.productId ?? ctx.payload.id ?? '').trim();
    const wait =
      ctx.payload.waitForCommand === false || ctx.payload.wait === false
        ? false
        : true;

    if (
      capability === 'PRODUCT_READ' ||
      operation === 'PRODUCT_READ' ||
      action === 'get' ||
      action === 'read'
    ) {
      if (action === 'catalogs' || action === 'list_catalogs') {
        const catalogs = await this.client.getCatalogs({ cookies, vendorId });
        return {
          responseExternalId: vendorId,
          rawResponse: { catalogs },
        };
      }
      if (action === 'list' || action === 'menu') {
        const menu = await this.client.getMenuProducts({ cookies, vendorId });
        return {
          responseExternalId: vendorId,
          rawResponse: menu as unknown as Record<string, unknown>,
        };
      }
      if (
        action === 'category_products' ||
        (ctx.payload.catalogId && ctx.payload.categoryId)
      ) {
        const catalogId = String(ctx.payload.catalogId ?? '');
        const categoryId = String(ctx.payload.categoryId ?? '');
        const products = await this.client.getCategoryProducts({
          cookies,
          vendorId,
          catalogId,
          categoryId,
        });
        return {
          responseExternalId: categoryId,
          rawResponse: { products },
        };
      }
      if (!productId) {
        throw new ProviderHttpError(
          'HUNGERSTATION: productId مطلوب للقراءة',
          400,
          null,
          'hungerstation',
        );
      }
      const product = await this.client.getProduct({
        cookies,
        vendorId,
        productId,
      });
      return { responseExternalId: productId, rawResponse: product };
    }

    if (
      capability === 'PRODUCT_CREATE' ||
      operation === 'PRODUCT_CREATE' ||
      action === 'create'
    ) {
      const product = asRecord(ctx.payload.product ?? ctx.payload);
      const raw = await this.client.createProduct({
        cookies,
        vendorId,
        product,
        waitForCommand: wait,
      });
      return {
        responseExternalId: String(
          raw.productId ?? raw.commandId ?? productId ?? '',
        ),
        rawResponse: raw,
      };
    }

    if (action === 'delete' || operation === 'PRODUCT_DELETE') {
      if (!productId) {
        throw new ProviderHttpError(
          'HUNGERSTATION: productId مطلوب للحذف',
          400,
          null,
          'hungerstation',
        );
      }
      const raw = await this.client.deleteProduct({
        cookies,
        vendorId,
        productId,
        waitForCommand: wait,
      });
      return { responseExternalId: productId, rawResponse: raw };
    }

    if (action === 'availability' || action === 'set_availability') {
      if (!productId) {
        throw new ProviderHttpError(
          'HUNGERSTATION: productId مطلوب لتحديث التوفر',
          400,
          null,
          'hungerstation',
        );
      }
      const available = Boolean(
        ctx.payload.available ??
        ctx.payload.active ??
        String(ctx.payload.availability ?? '').toUpperCase() === 'AVAILABLE',
      );
      const raw = await this.client.setProductAvailability({
        cookies,
        vendorId,
        productId,
        available,
        waitForCommand: wait,
      });
      return { responseExternalId: productId, rawResponse: raw };
    }

    if (action === 'upload_image' || action === 'image') {
      const fileBase64 = String(ctx.payload.fileBase64 ?? '').trim();
      if (!fileBase64) {
        throw new ProviderHttpError(
          'HUNGERSTATION: fileBase64 مطلوب لرفع الصورة',
          400,
          null,
          'hungerstation',
        );
      }
      const raw = await this.client.uploadProductImage({
        cookies,
        vendorId,
        productId: productId || undefined,
        fileBase64,
        fileName:
          typeof ctx.payload.fileName === 'string'
            ? ctx.payload.fileName
            : undefined,
        contentType:
          typeof ctx.payload.contentType === 'string'
            ? ctx.payload.contentType
            : undefined,
      });
      return {
        responseExternalId: productId || vendorId,
        rawResponse: raw,
      };
    }

    if (action === 'translate' || action === 'translation') {
      const nameAr = String(
        ctx.payload.nameAr ?? ctx.payload.name ?? '',
      ).trim();
      if (!nameAr) {
        throw new ProviderHttpError(
          'HUNGERSTATION: nameAr مطلوب للترجمة',
          400,
          null,
          'hungerstation',
        );
      }
      const raw = await this.client.requestProductTranslation({
        cookies,
        vendorId,
        nameAr,
        descriptionAr:
          typeof ctx.payload.descriptionAr === 'string'
            ? ctx.payload.descriptionAr
            : typeof ctx.payload.description === 'string'
              ? ctx.payload.description
              : undefined,
      });
      return { responseExternalId: vendorId, rawResponse: raw };
    }

    // Default PRODUCT_UPDATE → full update
    if (!productId) {
      throw new ProviderHttpError(
        'HUNGERSTATION: productId مطلوب للتحديث',
        400,
        null,
        'hungerstation',
      );
    }
    const product = asRecord(ctx.payload.product ?? ctx.payload);
    const raw = await this.client.updateProduct({
      cookies,
      vendorId,
      productId,
      product,
      waitForCommand: wait,
    });
    return { responseExternalId: productId, rawResponse: raw };
  }

  private async executeCategoryOperation(
    ctx: AdapterOperationContext,
    capability: string,
    operation: string,
  ): Promise<AdapterOperationResult> {
    const { cookies, vendorId } = this.session(ctx);
    const action = this.payloadKind(ctx);
    const catalogId = String(ctx.payload.catalogId ?? '').trim();
    const categoryId =
      ctx.externalTargetId?.trim() ||
      String(ctx.payload.categoryId ?? '').trim();
    const wait =
      ctx.payload.waitForCommand === false || ctx.payload.wait === false
        ? false
        : true;

    if (
      capability === 'CATEGORY_READ' ||
      operation === 'CATEGORY_READ' ||
      action === 'list' ||
      action === 'read'
    ) {
      const catalogs = await this.client.getCatalogs({ cookies, vendorId });
      return {
        responseExternalId: vendorId,
        rawResponse: { catalogs },
      };
    }

    if (!catalogId) {
      throw new ProviderHttpError(
        'HUNGERSTATION: catalogId مطلوب لعمليات التصنيف',
        400,
        null,
        'hungerstation',
      );
    }

    if (action === 'create' || operation === 'CATEGORY_CREATE') {
      const category = asRecord(ctx.payload.category ?? ctx.payload);
      const raw = await this.client.createCategory({
        cookies,
        vendorId,
        catalogId,
        category,
        waitForCommand: wait,
      });
      return {
        responseExternalId: String(raw.commandId ?? catalogId),
        rawResponse: raw,
      };
    }

    if (action === 'delete' || operation === 'CATEGORY_DELETE') {
      if (!categoryId) {
        throw new ProviderHttpError(
          'HUNGERSTATION: categoryId مطلوب للحذف',
          400,
          null,
          'hungerstation',
        );
      }
      const raw = await this.client.deleteCategory({
        cookies,
        vendorId,
        catalogId,
        categoryId,
        waitForCommand: wait,
      });
      return { responseExternalId: categoryId, rawResponse: raw };
    }

    // update (default CATEGORY_WRITE)
    if (!categoryId) {
      throw new ProviderHttpError(
        'HUNGERSTATION: categoryId مطلوب للتعديل',
        400,
        null,
        'hungerstation',
      );
    }
    const category = asRecord(ctx.payload.category ?? ctx.payload);
    const raw = await this.client.updateCategory({
      cookies,
      vendorId,
      catalogId,
      categoryId,
      category,
      waitForCommand: wait,
    });
    return { responseExternalId: categoryId, rawResponse: raw };
  }

  private async executeLocationOperation(
    ctx: AdapterOperationContext,
    capability: string,
    operation: string,
  ): Promise<AdapterOperationResult> {
    const { cookies, vendorId } = this.session(ctx);
    const action = this.payloadKind(ctx);

    if (
      capability === 'LOCATION_STATUS_UPDATE' ||
      operation === 'LOCATION_STATUS_UPDATE' ||
      operation === 'SET_AVAILABILITY' ||
      action === 'availability' ||
      action === 'set_availability'
    ) {
      const rawAvail = ctx.payload.availability ?? ctx.payload.open;
      const open =
        typeof rawAvail === 'boolean'
          ? rawAvail
          : String(rawAvail ?? 'OPEN').toUpperCase() === 'OPEN' ||
            String(rawAvail).toLowerCase() === 'true';
      const raw = await this.client.setAvailability({
        cookies,
        vendorId,
        availability: open ? 'OPEN' : 'CLOSED',
        closedReason:
          typeof ctx.payload.closedReason === 'string'
            ? ctx.payload.closedReason
            : typeof ctx.payload.reason === 'string'
              ? ctx.payload.reason
              : undefined,
        closedUntil:
          typeof ctx.payload.closedUntil === 'string'
            ? ctx.payload.closedUntil
            : undefined,
      });
      return { responseExternalId: vendorId, rawResponse: raw };
    }

    if (
      capability === 'LOCATION_UPDATE' ||
      operation === 'LOCATION_UPDATE' ||
      action === 'update_opening_times' ||
      action === 'opening_times_update'
    ) {
      const openingTimes =
        ctx.payload.openingTimes ?? ctx.payload.body ?? ctx.payload;
      const raw = await this.client.updateOpeningTimes({
        cookies,
        vendorId,
        openingTimes,
      });
      return { responseExternalId: vendorId, rawResponse: raw };
    }

    // LOCATION_READ / get opening times
    const raw = await this.client.getOpeningTimes({ cookies, vendorId });
    return { responseExternalId: vendorId, rawResponse: raw };
  }

  async processWebhook(
    ctx: AdapterWebhookContext,
  ): Promise<AdapterWebhookResult> {
    const payload = asRecord(ctx.payload);
    const order = asRecord(payload.order ?? payload.data ?? payload);
    const externalId = String(
      order.order_id ?? order.orderId ?? order.id ?? '',
    );
    if (!externalId) {
      return { ignored: true, reason: 'No order id in HS webhook' };
    }
    return {
      entityType: 'order',
      orders: [
        this.client.mapOrder({
          ...order,
          orderId: externalId,
          orderStatus: order.status ?? order.orderStatus,
        }),
      ],
    };
  }
}

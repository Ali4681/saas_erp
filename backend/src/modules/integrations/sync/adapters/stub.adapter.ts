import { createHmac, timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type {
  AdapterAuthContext,
  AdapterOperationContext,
  AdapterOperationResult,
  AdapterSyncContext,
  AdapterSyncResult,
  AdapterWebhookContext,
  AdapterWebhookResult,
  ProviderAdapter,
} from './adapter.types';

/**
 * Deterministic stub adapter for sync-engine / mirror verification.
 * Real HTTP provider clients replace this per-provider in later phases.
 */
@Injectable()
export class StubProviderAdapter implements ProviderAdapter {
  readonly providerCode = '*';
  /** Catch-all fake data until a dedicated adapter is registered. */
  readonly isReal = false;

  async testAuth(ctx: AdapterAuthContext): Promise<boolean> {
    return Boolean(
      ctx.credentials.accessToken ||
      ctx.credentials.apiKey ||
      ctx.credentials.password ||
      ctx.credentials.clientSecret ||
      (ctx.credentials.cookies && typeof ctx.credentials.cookies === 'object'),
    );
  }

  async syncEntity(ctx: AdapterSyncContext): Promise<AdapterSyncResult> {
    const code = ctx.providerCode.toLowerCase();
    const page = ctx.cursor ? Number(ctx.cursor) : 0;
    if (page > 0) {
      return { items: [], nextCursor: null, hasMore: false };
    }

    if (ctx.entityType === 'location') {
      return {
        items: [
          {
            externalId: `${code}-loc-1`,
            name: `${ctx.providerCode} Main Outlet`,
            code: 'MAIN',
            status: 'ACTIVE',
            city: 'Riyadh',
            timezone: 'Asia/Riyadh',
            rawPayload: { stub: true },
          },
          {
            externalId: `${code}-loc-2`,
            name: `${ctx.providerCode} Branch Outlet`,
            code: 'BR2',
            status: 'ACTIVE',
            city: 'Jeddah',
            timezone: 'Asia/Riyadh',
            rawPayload: { stub: true },
          },
        ],
        nextCursor: '1',
        hasMore: false,
      };
    }

    if (ctx.entityType === 'category') {
      return {
        items: [],
        categories: [
          {
            externalId: `${code}-cat-1`,
            name: 'Main Menu',
            status: 'ACTIVE',
            sortOrder: 1,
            rawPayload: { stub: true },
          },
        ],
        nextCursor: null,
        hasMore: false,
      };
    }

    if (ctx.entityType === 'product') {
      return {
        items: [],
        products: [
          {
            externalId: `${code}-prod-1`,
            name: 'Stub Burger',
            sku: 'BURGER-1',
            status: 'ACTIVE',
            price: '24.50',
            currency: 'SAR',
            categoryExternalId: `${code}-cat-1`,
            variants: [
              {
                externalId: `${code}-var-1`,
                name: 'Regular',
                sku: 'BURGER-1-R',
                price: '24.50',
                status: 'ACTIVE',
              },
            ],
            rawPayload: { stub: true },
          },
        ],
        nextCursor: null,
        hasMore: false,
      };
    }

    if (ctx.entityType === 'customer') {
      return {
        items: [],
        customers: [
          {
            externalId: `${code}-cust-1`,
            displayName: 'Stub Customer',
            email: 'stub@example.com',
            phone: '+966500000000',
            status: 'ACTIVE',
            rawPayload: { stub: true },
          },
        ],
        nextCursor: null,
        hasMore: false,
      };
    }

    if (ctx.entityType === 'order') {
      return {
        items: [],
        orders: [
          {
            externalId: `${code}-ord-1`,
            externalNumber: 'ORD-1001',
            status: 'CONFIRMED',
            financialStatus: 'PAID',
            fulfillmentStatus: 'PROCESSING',
            placedAt: new Date().toISOString(),
            currency: 'SAR',
            subtotal: '24.50',
            taxAmount: '3.68',
            totalAmount: '28.18',
            customerExternalId: `${code}-cust-1`,
            projectLocationExternalId: `${code}-loc-1`,
            items: [
              {
                externalId: 'line-1',
                name: 'Stub Burger',
                sku: 'BURGER-1',
                quantity: '1',
                unitPrice: '24.50',
                totalAmount: '24.50',
                productExternalId: `${code}-prod-1`,
              },
            ],
            statusHistory: [
              {
                externalStatus: 'CONFIRMED',
                occurredAt: new Date().toISOString(),
                source: 'POLL',
              },
            ],
            rawPayload: { stub: true, providerStatus: 'confirmed' },
          },
        ],
        nextCursor: null,
        hasMore: false,
      };
    }

    if (ctx.entityType === 'promotion') {
      return {
        items: [],
        promotions: [
          {
            externalId: `${code}-promo-1`,
            name: '10% Off',
            promotionType: 'PERCENT',
            value: '10',
            status: 'ACTIVE',
            rawPayload: { stub: true },
          },
        ],
        nextCursor: null,
        hasMore: false,
      };
    }

    if (ctx.entityType === 'settlement') {
      return {
        items: [],
        settlements: [
          {
            externalId: `${code}-set-1`,
            status: 'EXPECTED',
            periodStart: '2026-07-01',
            periodEnd: '2026-07-15',
            grossSales: '1000.00',
            providerFees: '150.00',
            refunds: '0',
            adjustments: '0',
            netAmount: '850.00',
            currency: 'SAR',
            rawPayload: { stub: true },
          },
        ],
        nextCursor: null,
        hasMore: false,
      };
    }

    if (ctx.entityType === 'installment') {
      return {
        items: [],
        installments: [
          {
            externalId: `${code}-inst-1`,
            merchantOrderReference: 'MERCH-5001',
            status: 'AUTHORIZED',
            amount: '199.00',
            currency: 'SAR',
            checkoutUrl: 'https://example.local/checkout/stub',
            authorizedAt: new Date().toISOString(),
            rawPayload: { stub: true },
          },
        ],
        nextCursor: null,
        hasMore: false,
      };
    }

    return {
      items: [
        {
          externalId: `${code}-${ctx.entityType}-1`,
          name: `Stub ${ctx.entityType}`,
          status: 'ACTIVE',
          rawPayload: { stub: true, entityType: ctx.entityType },
        },
      ],
      nextCursor: null,
      hasMore: false,
    };
  }

  async executeOperation(
    ctx: AdapterOperationContext,
  ): Promise<AdapterOperationResult> {
    return {
      responseExternalId:
        ctx.externalTargetId ??
        `stub-op-${ctx.capabilityCode.toLowerCase()}-${Date.now()}`,
      rawResponse: {
        stub: true,
        operationType: ctx.operationType,
        idempotencyKey: ctx.idempotencyKey,
      },
    };
  }

  async processWebhook(
    ctx: AdapterWebhookContext,
  ): Promise<AdapterWebhookResult> {
    const payload = ctx.payload;
    const externalId =
      (typeof payload.id === 'string' && payload.id) ||
      (typeof payload.externalId === 'string' && payload.externalId) ||
      ctx.providerEventId;

    if (!externalId) {
      return { ignored: true, reason: 'no external id in webhook payload' };
    }

    const event = ctx.eventType.toLowerCase();
    if (event.includes('location')) {
      return {
        entityType: 'location',
        items: [
          {
            externalId,
            name:
              typeof payload.name === 'string'
                ? payload.name
                : `Webhook location ${externalId}`,
            status: 'ACTIVE',
            rawPayload: payload,
          },
        ],
      };
    }

    if (event.includes('product')) {
      return {
        entityType: 'product',
        products: [
          {
            externalId,
            name:
              typeof payload.name === 'string'
                ? payload.name
                : `Webhook product ${externalId}`,
            status: 'ACTIVE',
            price:
              typeof payload.price === 'string' ||
              typeof payload.price === 'number'
                ? payload.price
                : '10.00',
            currency: 'SAR',
            rawPayload: payload,
          },
        ],
      };
    }

    return {
      entityType: 'order',
      orders: [
        {
          externalId,
          status:
            typeof payload.status === 'string' ? payload.status : 'UNKNOWN',
          financialStatus: 'PAID',
          placedAt: new Date().toISOString(),
          currency: 'SAR',
          totalAmount:
            typeof payload.total === 'string' ||
            typeof payload.total === 'number'
              ? payload.total
              : '10.00',
          items: [
            {
              externalId: 'wh-line-1',
              name: 'Webhook line',
              quantity: '1',
              unitPrice: '10.00',
              totalAmount: '10.00',
            },
          ],
          rawPayload: payload,
        },
      ],
    };
  }

  verifyWebhookSignature(input: {
    rawBody: string;
    signatureHeader: string | undefined;
    credentials: { webhookSecret?: string; [key: string]: unknown };
  }): boolean {
    const secret = input.credentials.webhookSecret;
    if (!secret || typeof secret !== 'string') {
      return false;
    }
    if (!input.signatureHeader) {
      return false;
    }
    const expected = createHmac('sha256', secret)
      .update(input.rawBody)
      .digest('hex');
    const provided = input.signatureHeader.replace(/^sha256=/i, '').trim();
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(provided, 'utf8');
    if (a.length !== b.length) {
      return false;
    }
    return timingSafeEqual(a, b);
  }
}

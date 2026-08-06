import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../database/prisma.service';
import type { MirrorInstallmentInput } from '../../mirrors/mirror-upsert.service';
import { BaseProviderAdapter } from './base.adapter';
import { asRecord } from './credential-resolve';
import { MadfuClient } from './madfu.client';
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
export class MadfuProviderAdapter extends BaseProviderAdapter {
  readonly providerCode = 'MADFU';

  constructor(
    private readonly client: MadfuClient,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  private creds(ctx: AdapterAuthContext) {
    return this.client.resolveCredentials(ctx.credentials);
  }

  async testAuth(ctx: AdapterAuthContext): Promise<boolean> {
    try {
      const creds = this.creds(ctx);
      await this.client.obtainJwt(creds);
      return true;
    } catch {
      return false;
    }
  }

  async syncEntity(ctx: AdapterSyncContext): Promise<AdapterSyncResult> {
    const entity = ctx.entityType.toLowerCase();
    if (entity !== 'installment' && entity !== 'payment') {
      return { items: [], nextCursor: null, hasMore: false };
    }

    // Madfu has no list-all; refresh known installment mirrors for this project.
    const offset = Math.max(0, Number(ctx.cursor ?? '0') || 0);
    const take = 50;
    const rows = await this.prisma.installmentTransaction.findMany({
      where: { connectedProjectId: ctx.connectedProjectId },
      orderBy: { lastSyncedAt: 'desc' },
      skip: offset,
      take,
      select: {
        externalId: true,
        merchantOrderReference: true,
        amount: true,
        rawPayload: true,
      },
    });

    if (!rows.length) {
      return {
        items: [],
        installments: [],
        nextCursor: null,
        hasMore: false,
      };
    }

    const creds = this.creds(ctx);
    const jwt = await this.client.obtainJwt(creds);
    const installments: MirrorInstallmentInput[] = [];

    for (const row of rows) {
      const raw = asRecord(row.rawPayload);
      const invoiceCode = String(
        raw.invoiceCode ?? raw.invoceCode ?? '',
      ).trim();
      try {
        const data = await this.client.getOrderStatus(creds, jwt, {
          orderId: row.externalId || undefined,
          invoiceCode: invoiceCode || undefined,
          merchantReference: row.merchantOrderReference || undefined,
        });
        const mapped = this.client.mapInstallment(data, {
          externalId: row.externalId,
          merchantOrderReference: row.merchantOrderReference,
          amount: String(row.amount),
        });
        if (mapped.externalId) installments.push(mapped);
      } catch (error) {
        this.client.logWarn(
          `MADFU refresh skipped ${row.externalId}: ${
            error instanceof Error ? error.message : error
          }`,
        );
      }
    }

    const nextOffset = offset + rows.length;
    const hasMore = rows.length === take;
    return {
      items: [],
      installments,
      nextCursor: hasMore ? String(nextOffset) : null,
      hasMore,
    };
  }

  async executeOperation(
    ctx: AdapterOperationContext,
  ): Promise<AdapterOperationResult> {
    const creds = this.creds(ctx);
    const jwt = await this.client.obtainJwt(creds);
    const op = ctx.operationType.toUpperCase();
    const payload = asRecord(ctx.payload);
    const target = ctx.externalTargetId ?? '';

    if (op.includes('CANCEL')) {
      const data = await this.client.cancel(creds, jwt, {
        invoiceCode: String(payload.invoiceCode ?? target),
        merchantReference: String(
          payload.merchantReference ?? payload.merchant_order_reference ?? '',
        ),
      });
      return { responseExternalId: target || null, rawResponse: data };
    }

    if (op.includes('REFUND')) {
      const orderId = Number(payload.orderId ?? payload.orderid ?? target);
      const amount = Number(payload.amount ?? 0);
      if (!Number.isFinite(orderId) || !orderId) {
        throw new ProviderHttpError(
          'MADFU: refund requires numeric orderId',
          400,
          null,
          creds.baseUrl,
        );
      }
      const data = await this.client.refund(creds, jwt, {
        orderId,
        amount,
        merchantReference: String(
          payload.merchantReference ?? payload.referenceNumber ?? '',
        ),
      });
      return { responseExternalId: String(orderId), rawResponse: data };
    }

    if (op.includes('SHARE')) {
      const mobile = String(payload.mobile ?? payload.mobileNumber ?? '');
      const amount = Number(payload.amount ?? 0);
      if (!mobile) {
        throw new ProviderHttpError(
          'MADFU: share requires mobile',
          400,
          null,
          creds.baseUrl,
        );
      }
      const data = await this.client.share(creds, jwt, {
        mobile,
        amount,
        merchantReference: String(payload.merchantReference ?? ''),
      });
      return { responseExternalId: target || null, rawResponse: data };
    }

    throw new ProviderHttpError(
      `MADFU: unsupported operation ${ctx.operationType}`,
      400,
      null,
      creds.baseUrl,
    );
  }

  async processWebhook(
    ctx: AdapterWebhookContext,
  ): Promise<AdapterWebhookResult> {
    const payload = asRecord(ctx.payload);
    const orderId = String(payload.orderId ?? payload.order_id ?? '');
    if (!orderId) {
      return { ignored: true, reason: 'No orderId in Madfu webhook' };
    }
    return {
      entityType: 'installment',
      installments: [
        this.client.mapInstallment(payload, { externalId: orderId }),
      ],
    };
  }
}

import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { EncryptionService } from '../../../common/encryption/encryption.service';
import { PrismaService } from '../../../database/prisma.service';
import {
  mapFinancialStatus,
  mapFulfillmentStatus,
  mapInstallmentStatus,
  mapOrderStatus,
  mapRecordStatus,
  mapSettlementStatus,
} from './status-mapper';

export type MirrorCategoryInput = {
  externalId: string;
  name: string;
  parentExternalId?: string | null;
  projectLocationExternalId?: string | null;
  status?: string | null;
  sortOrder?: number | null;
  rawPayload?: Record<string, unknown>;
};

export type MirrorProductInput = {
  externalId: string;
  name: string;
  sku?: string | null;
  description?: string | null;
  status?: string | null;
  price?: string | number | null;
  currency?: string | null;
  taxRate?: string | number | null;
  imageUrl?: string | null;
  categoryExternalId?: string | null;
  projectLocationExternalId?: string | null;
  variants?: Array<{
    externalId: string;
    name: string;
    sku?: string | null;
    status?: string | null;
    price?: string | number | null;
    rawPayload?: Record<string, unknown>;
  }>;
  rawPayload?: Record<string, unknown>;
};

export type MirrorCustomerInput = {
  externalId: string;
  displayName?: string | null;
  email?: string | null;
  phone?: string | null;
  status?: string | null;
  rawPayload?: Record<string, unknown>;
};

export type MirrorOrderItemInput = {
  externalId?: string | null;
  name: string;
  sku?: string | null;
  quantity: string | number;
  unitPrice: string | number;
  discountAmount?: string | number;
  taxAmount?: string | number;
  totalAmount: string | number;
  productExternalId?: string | null;
  variantExternalId?: string | null;
  rawPayload?: Record<string, unknown>;
};

export type MirrorOrderInput = {
  externalId: string;
  externalNumber?: string | null;
  status?: string | null;
  financialStatus?: string | null;
  fulfillmentStatus?: string | null;
  placedAt?: string | Date;
  currency?: string;
  subtotal?: string | number;
  discountAmount?: string | number;
  taxAmount?: string | number;
  deliveryFee?: string | number;
  providerFee?: string | number;
  totalAmount: string | number;
  netAmount?: string | number | null;
  paymentMethod?: string | null;
  customerExternalId?: string | null;
  projectLocationExternalId?: string | null;
  items?: MirrorOrderItemInput[];
  statusHistory?: Array<{
    externalStatus: string;
    occurredAt?: string | Date;
    source?: 'POLL' | 'WEBHOOK' | 'USER_ACTION' | 'RECONCILIATION';
    rawPayload?: Record<string, unknown>;
  }>;
  rawPayload?: Record<string, unknown>;
};

export type MirrorInstallmentInput = {
  externalId: string;
  merchantOrderReference: string;
  externalCustomerReference?: string | null;
  status?: string | null;
  amount: string | number;
  currency?: string;
  providerFee?: string | number | null;
  netAmount?: string | number | null;
  checkoutUrl?: string | null;
  authorizedAt?: string | Date | null;
  capturedAt?: string | Date | null;
  closedAt?: string | Date | null;
  rawPayload?: Record<string, unknown>;
};

export type MirrorPromotionInput = {
  externalId: string;
  name: string;
  promotionType: string;
  value?: string | number | null;
  status?: string | null;
  startsAt?: string | Date | null;
  endsAt?: string | Date | null;
  projectLocationExternalId?: string | null;
  rawPayload?: Record<string, unknown>;
};

export type MirrorSettlementInput = {
  externalId: string;
  status?: string | null;
  periodStart?: string | Date | null;
  periodEnd?: string | Date | null;
  grossSales?: string | number;
  providerFees?: string | number;
  refunds?: string | number;
  adjustments?: string | number;
  netAmount: string | number;
  currency?: string;
  expectedAt?: string | Date | null;
  paidAt?: string | Date | null;
  rawPayload?: Record<string, unknown>;
};

function dec(value: string | number | null | undefined, fallback = '0') {
  if (value == null || value === '') return fallback;
  return String(value);
}

function asDate(value: string | Date | null | undefined, fallback?: Date) {
  if (!value) return fallback ?? null;
  return value instanceof Date ? value : new Date(value);
}

function json(value: Record<string, unknown> | undefined): Prisma.InputJsonValue {
  return (value ?? {}) as Prisma.InputJsonValue;
}

@Injectable()
export class MirrorUpsertService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {}

  async upsertCategories(
    connectedProjectId: string,
    items: MirrorCategoryInput[],
  ): Promise<number> {
    let count = 0;
    for (const item of items) {
      const locationId = await this.resolveLocationId(
        connectedProjectId,
        item.projectLocationExternalId,
      );
      await this.prisma.externalCategory.upsert({
        where: {
          connectedProjectId_externalId: {
            connectedProjectId,
            externalId: item.externalId,
          },
        },
        create: {
          connectedProjectId,
          projectLocationId: locationId,
          externalId: item.externalId,
          parentExternalId: item.parentExternalId ?? null,
          name: item.name,
          status: mapRecordStatus(item.status),
          sortOrder: item.sortOrder ?? null,
          rawPayload: json(item.rawPayload),
          lastSyncedAt: new Date(),
        },
        update: {
          projectLocationId: locationId,
          parentExternalId: item.parentExternalId ?? null,
          name: item.name,
          status: mapRecordStatus(item.status),
          sortOrder: item.sortOrder ?? null,
          rawPayload: json(item.rawPayload),
          lastSyncedAt: new Date(),
        },
      });
      count += 1;
    }
    return count;
  }

  async upsertProducts(
    connectedProjectId: string,
    items: MirrorProductInput[],
  ): Promise<number> {
    let count = 0;
    for (const item of items) {
      const locationId = await this.resolveLocationId(
        connectedProjectId,
        item.projectLocationExternalId,
      );
      const categoryId = item.categoryExternalId
        ? (
            await this.prisma.externalCategory.findUnique({
              where: {
                connectedProjectId_externalId: {
                  connectedProjectId,
                  externalId: item.categoryExternalId,
                },
              },
            })
          )?.id ?? null
        : null;

      const product = await this.prisma.externalProduct.upsert({
        where: {
          connectedProjectId_externalId: {
            connectedProjectId,
            externalId: item.externalId,
          },
        },
        create: {
          connectedProjectId,
          projectLocationId: locationId,
          externalCategoryId: categoryId,
          externalId: item.externalId,
          sku: item.sku ?? null,
          name: item.name,
          description: item.description ?? null,
          status: mapRecordStatus(item.status),
          price: item.price != null ? dec(item.price) : null,
          currency: item.currency ?? null,
          taxRate: item.taxRate != null ? dec(item.taxRate) : null,
          imageUrl: item.imageUrl ?? null,
          rawPayload: json(item.rawPayload),
          lastSyncedAt: new Date(),
        },
        update: {
          projectLocationId: locationId,
          externalCategoryId: categoryId,
          sku: item.sku ?? null,
          name: item.name,
          description: item.description ?? null,
          status: mapRecordStatus(item.status),
          price: item.price != null ? dec(item.price) : null,
          currency: item.currency ?? null,
          taxRate: item.taxRate != null ? dec(item.taxRate) : null,
          imageUrl: item.imageUrl ?? null,
          rawPayload: json(item.rawPayload),
          lastSyncedAt: new Date(),
        },
      });

      for (const variant of item.variants ?? []) {
        await this.prisma.externalProductVariant.upsert({
          where: {
            externalProductId_externalId: {
              externalProductId: product.id,
              externalId: variant.externalId,
            },
          },
          create: {
            externalProductId: product.id,
            externalId: variant.externalId,
            sku: variant.sku ?? null,
            name: variant.name,
            status: mapRecordStatus(variant.status),
            price: variant.price != null ? dec(variant.price) : null,
            rawPayload: json(variant.rawPayload),
            lastSyncedAt: new Date(),
          },
          update: {
            sku: variant.sku ?? null,
            name: variant.name,
            status: mapRecordStatus(variant.status),
            price: variant.price != null ? dec(variant.price) : null,
            rawPayload: json(variant.rawPayload),
            lastSyncedAt: new Date(),
          },
        });
      }
      count += 1;
    }
    return count;
  }

  async upsertCustomers(
    connectedProjectId: string,
    items: MirrorCustomerInput[],
  ): Promise<number> {
    let count = 0;
    for (const item of items) {
      const emailEnc = item.email ? this.encryption.encrypt(item.email) : null;
      const phoneEnc = item.phone ? this.encryption.encrypt(item.phone) : null;
      await this.prisma.externalCustomer.upsert({
        where: {
          connectedProjectId_externalId: {
            connectedProjectId,
            externalId: item.externalId,
          },
        },
        create: {
          connectedProjectId,
          externalId: item.externalId,
          displayName: item.displayName ?? null,
          emailCiphertext: emailEnc
            ? Uint8Array.from(emailEnc.ciphertext)
            : null,
          phoneCiphertext: phoneEnc
            ? Uint8Array.from(phoneEnc.ciphertext)
            : null,
          keyVersion: emailEnc?.keyVersion ?? phoneEnc?.keyVersion ?? null,
          status: mapRecordStatus(item.status),
          rawPayload: json(item.rawPayload),
          lastSyncedAt: new Date(),
        },
        update: {
          displayName: item.displayName ?? null,
          ...(emailEnc
            ? {
                emailCiphertext: Uint8Array.from(emailEnc.ciphertext),
                keyVersion: emailEnc.keyVersion,
              }
            : {}),
          ...(phoneEnc
            ? {
                phoneCiphertext: Uint8Array.from(phoneEnc.ciphertext),
                keyVersion: phoneEnc.keyVersion,
              }
            : {}),
          status: mapRecordStatus(item.status),
          rawPayload: json(item.rawPayload),
          lastSyncedAt: new Date(),
        },
      });
      count += 1;
    }
    return count;
  }

  async upsertOrders(
    connectedProjectId: string,
    items: MirrorOrderInput[],
    source: 'POLL' | 'WEBHOOK' = 'POLL',
  ): Promise<number> {
    let count = 0;
    for (const item of items) {
      const locationId = await this.resolveLocationId(
        connectedProjectId,
        item.projectLocationExternalId,
      );
      const customerId = item.customerExternalId
        ? (
            await this.prisma.externalCustomer.findUnique({
              where: {
                connectedProjectId_externalId: {
                  connectedProjectId,
                  externalId: item.customerExternalId,
                },
              },
            })
          )?.id ?? null
        : null;

      const order = await this.prisma.externalOrder.upsert({
        where: {
          connectedProjectId_externalId: {
            connectedProjectId,
            externalId: item.externalId,
          },
        },
        create: {
          connectedProjectId,
          projectLocationId: locationId,
          externalCustomerId: customerId,
          externalId: item.externalId,
          externalNumber: item.externalNumber ?? null,
          status: mapOrderStatus(item.status),
          financialStatus: mapFinancialStatus(item.financialStatus),
          fulfillmentStatus: mapFulfillmentStatus(item.fulfillmentStatus),
          placedAt: asDate(item.placedAt, new Date())!,
          currency: item.currency ?? 'SAR',
          subtotal: dec(item.subtotal),
          discountAmount: dec(item.discountAmount),
          taxAmount: dec(item.taxAmount),
          deliveryFee: dec(item.deliveryFee),
          providerFee: dec(item.providerFee),
          totalAmount: dec(item.totalAmount),
          netAmount: item.netAmount != null ? dec(item.netAmount) : null,
          paymentMethod: item.paymentMethod ?? null,
          rawPayload: json(item.rawPayload),
          lastSyncedAt: new Date(),
        },
        update: {
          projectLocationId: locationId,
          externalCustomerId: customerId,
          externalNumber: item.externalNumber ?? null,
          status: mapOrderStatus(item.status),
          financialStatus: mapFinancialStatus(item.financialStatus),
          fulfillmentStatus: mapFulfillmentStatus(item.fulfillmentStatus),
          placedAt: asDate(item.placedAt, new Date())!,
          currency: item.currency ?? 'SAR',
          subtotal: dec(item.subtotal),
          discountAmount: dec(item.discountAmount),
          taxAmount: dec(item.taxAmount),
          deliveryFee: dec(item.deliveryFee),
          providerFee: dec(item.providerFee),
          totalAmount: dec(item.totalAmount),
          netAmount: item.netAmount != null ? dec(item.netAmount) : null,
          paymentMethod: item.paymentMethod ?? null,
          rawPayload: json(item.rawPayload),
          lastSyncedAt: new Date(),
        },
      });

      for (const line of item.items ?? []) {
        const externalIdKey = line.externalId ?? `${item.externalId}:${line.name}`;
        const productId = line.productExternalId
          ? (
              await this.prisma.externalProduct.findUnique({
                where: {
                  connectedProjectId_externalId: {
                    connectedProjectId,
                    externalId: line.productExternalId,
                  },
                },
              })
            )?.id ?? null
          : null;
        let variantId: string | null = null;
        if (productId && line.variantExternalId) {
          variantId =
            (
              await this.prisma.externalProductVariant.findUnique({
                where: {
                  externalProductId_externalId: {
                    externalProductId: productId,
                    externalId: line.variantExternalId,
                  },
                },
              })
            )?.id ?? null;
        }

        await this.prisma.externalOrderItem.upsert({
          where: {
            externalOrderId_externalIdKey: {
              externalOrderId: order.id,
              externalIdKey,
            },
          },
          create: {
            externalOrderId: order.id,
            externalId: line.externalId ?? null,
            externalIdKey,
            externalProductId: productId,
            externalProductVariantId: variantId,
            name: line.name,
            sku: line.sku ?? null,
            quantity: dec(line.quantity, '1'),
            unitPrice: dec(line.unitPrice),
            discountAmount: dec(line.discountAmount),
            taxAmount: dec(line.taxAmount),
            totalAmount: dec(line.totalAmount),
            rawPayload: json(line.rawPayload),
          },
          update: {
            externalId: line.externalId ?? null,
            externalProductId: productId,
            externalProductVariantId: variantId,
            name: line.name,
            sku: line.sku ?? null,
            quantity: dec(line.quantity, '1'),
            unitPrice: dec(line.unitPrice),
            discountAmount: dec(line.discountAmount),
            taxAmount: dec(line.taxAmount),
            totalAmount: dec(line.totalAmount),
            rawPayload: json(line.rawPayload),
          },
        });
      }

      const history =
        item.statusHistory ??
        (item.status
          ? [
              {
                externalStatus: item.status,
                occurredAt: new Date(),
                source,
              },
            ]
          : []);

      for (const entry of history) {
        const occurredAt = asDate(entry.occurredAt, new Date())!;
        const normalized = mapOrderStatus(entry.externalStatus);
        const existing = await this.prisma.externalOrderStatusHistory.findFirst({
          where: {
            externalOrderId: order.id,
            externalStatus: entry.externalStatus,
            occurredAt,
          },
        });
        if (!existing) {
          await this.prisma.externalOrderStatusHistory.create({
            data: {
              externalOrderId: order.id,
              externalStatus: entry.externalStatus,
              normalizedStatus: normalized,
              source: entry.source ?? source,
              occurredAt,
              rawPayload: json(entry.rawPayload),
            },
          });
        }
      }

      count += 1;
    }
    return count;
  }

  async upsertPromotions(
    connectedProjectId: string,
    items: MirrorPromotionInput[],
  ): Promise<number> {
    let count = 0;
    for (const item of items) {
      const locationId = await this.resolveLocationId(
        connectedProjectId,
        item.projectLocationExternalId,
      );
      await this.prisma.externalPromotion.upsert({
        where: {
          connectedProjectId_externalId: {
            connectedProjectId,
            externalId: item.externalId,
          },
        },
        create: {
          connectedProjectId,
          projectLocationId: locationId,
          externalId: item.externalId,
          name: item.name,
          promotionType: item.promotionType,
          value: item.value != null ? dec(item.value) : null,
          startsAt: asDate(item.startsAt),
          endsAt: asDate(item.endsAt),
          status: mapRecordStatus(item.status),
          rawPayload: json(item.rawPayload),
        },
        update: {
          projectLocationId: locationId,
          name: item.name,
          promotionType: item.promotionType,
          value: item.value != null ? dec(item.value) : null,
          startsAt: asDate(item.startsAt),
          endsAt: asDate(item.endsAt),
          status: mapRecordStatus(item.status),
          rawPayload: json(item.rawPayload),
        },
      });
      count += 1;
    }
    return count;
  }

  async upsertSettlements(
    connectedProjectId: string,
    items: MirrorSettlementInput[],
  ): Promise<number> {
    let count = 0;
    for (const item of items) {
      await this.prisma.externalSettlement.upsert({
        where: {
          connectedProjectId_externalId: {
            connectedProjectId,
            externalId: item.externalId,
          },
        },
        create: {
          connectedProjectId,
          externalId: item.externalId,
          periodStart: asDate(item.periodStart),
          periodEnd: asDate(item.periodEnd),
          status: mapSettlementStatus(item.status),
          grossSales: dec(item.grossSales),
          providerFees: dec(item.providerFees),
          refunds: dec(item.refunds),
          adjustments: dec(item.adjustments),
          netAmount: dec(item.netAmount),
          currency: item.currency ?? 'SAR',
          expectedAt: asDate(item.expectedAt),
          paidAt: asDate(item.paidAt),
          rawPayload: json(item.rawPayload),
        },
        update: {
          periodStart: asDate(item.periodStart),
          periodEnd: asDate(item.periodEnd),
          status: mapSettlementStatus(item.status),
          grossSales: dec(item.grossSales),
          providerFees: dec(item.providerFees),
          refunds: dec(item.refunds),
          adjustments: dec(item.adjustments),
          netAmount: dec(item.netAmount),
          currency: item.currency ?? 'SAR',
          expectedAt: asDate(item.expectedAt),
          paidAt: asDate(item.paidAt),
          rawPayload: json(item.rawPayload),
        },
      });
      count += 1;
    }
    return count;
  }

  async upsertInstallments(
    connectedProjectId: string,
    items: MirrorInstallmentInput[],
  ): Promise<number> {
    let count = 0;
    for (const item of items) {
      await this.prisma.installmentTransaction.upsert({
        where: {
          connectedProjectId_externalId: {
            connectedProjectId,
            externalId: item.externalId,
          },
        },
        create: {
          connectedProjectId,
          externalId: item.externalId,
          merchantOrderReference: item.merchantOrderReference,
          externalCustomerReference: item.externalCustomerReference ?? null,
          status: mapInstallmentStatus(item.status),
          amount: dec(item.amount, '1'),
          currency: item.currency ?? 'SAR',
          providerFee: item.providerFee != null ? dec(item.providerFee) : null,
          netAmount: item.netAmount != null ? dec(item.netAmount) : null,
          checkoutUrl: item.checkoutUrl ?? null,
          authorizedAt: asDate(item.authorizedAt),
          capturedAt: asDate(item.capturedAt),
          closedAt: asDate(item.closedAt),
          rawPayload: json(item.rawPayload),
          lastSyncedAt: new Date(),
        },
        update: {
          merchantOrderReference: item.merchantOrderReference,
          externalCustomerReference: item.externalCustomerReference ?? null,
          status: mapInstallmentStatus(item.status),
          amount: dec(item.amount, '1'),
          currency: item.currency ?? 'SAR',
          providerFee: item.providerFee != null ? dec(item.providerFee) : null,
          netAmount: item.netAmount != null ? dec(item.netAmount) : null,
          checkoutUrl: item.checkoutUrl ?? null,
          authorizedAt: asDate(item.authorizedAt),
          capturedAt: asDate(item.capturedAt),
          closedAt: asDate(item.closedAt),
          rawPayload: json(item.rawPayload),
          lastSyncedAt: new Date(),
        },
      });
      count += 1;
    }
    return count;
  }

  private async resolveLocationId(
    connectedProjectId: string,
    externalId?: string | null,
  ): Promise<string | null> {
    if (!externalId) return null;
    const location = await this.prisma.projectLocation.findUnique({
      where: {
        connectedProjectId_externalId: {
          connectedProjectId,
          externalId,
        },
      },
    });
    return location?.id ?? null;
  }
}

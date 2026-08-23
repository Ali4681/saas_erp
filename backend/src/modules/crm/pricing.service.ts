import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { TenantContextService } from '../../common/tenant/tenant-context.service';

@Injectable()
export class PricingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async listPriceLists(companyId: string) {
    this.tenant.setCompanyId(companyId);
    return this.prisma.priceList.findMany({
      where: { companyId },
      include: { _count: { select: { entries: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async createPriceList(input: {
    companyId: string;
    name: string;
    listType?: string;
    currency?: string;
    isDefault?: boolean;
    notes?: string;
  }) {
    this.tenant.setCompanyId(input.companyId);
    return this.prisma.priceList.create({
      data: {
        companyId: input.companyId,
        name: input.name,
        listType: input.listType ?? 'RETAIL',
        currency: input.currency ?? 'SAR',
        isDefault: input.isDefault ?? false,
        notes: input.notes,
      },
    });
  }

  async upsertEntry(input: {
    priceListId: string;
    itemId: string;
    unitPrice: number;
    minQty?: number;
    isVolumeBreak?: boolean;
    floorPrice?: number | null;
    validFrom?: string | null;
    validTo?: string | null;
  }) {
    const existing = await this.prisma.priceListEntry.findFirst({
      where: {
        priceListId: input.priceListId,
        itemId: input.itemId,
        minQty: input.minQty ?? 1,
      },
    });
    if (existing) {
      return this.prisma.priceListEntry.update({
        where: { id: existing.id },
        data: {
          unitPrice: input.unitPrice,
          isVolumeBreak: input.isVolumeBreak ?? false,
          floorPrice: input.floorPrice ?? null,
          validFrom: input.validFrom ? new Date(input.validFrom) : null,
          validTo: input.validTo ? new Date(input.validTo) : null,
        },
      });
    }
    return this.prisma.priceListEntry.create({
      data: {
        priceListId: input.priceListId,
        itemId: input.itemId,
        unitPrice: input.unitPrice,
        minQty: input.minQty ?? 1,
        isVolumeBreak: input.isVolumeBreak ?? false,
        floorPrice: input.floorPrice ?? null,
        validFrom: input.validFrom ? new Date(input.validFrom) : null,
        validTo: input.validTo ? new Date(input.validTo) : null,
      },
    });
  }

  async getItemPrice(
    companyId: string,
    priceListId: string,
    itemId: string,
    qty: number,
  ) {
    this.tenant.setCompanyId(companyId);
    const entries = await this.prisma.priceListEntry.findMany({
      where: { priceListId, itemId },
      orderBy: { minQty: 'desc' },
    });
    const now = new Date();
    const applicable = entries
      .filter((e) => {
        const qtyOk = Number(e.minQty) <= qty;
        const fromOk = !e.validFrom || e.validFrom <= now;
        const toOk = !e.validTo || e.validTo >= now;
        return qtyOk && fromOk && toOk;
      })
      .at(0);
    if (!applicable) return null;
    return { unitPrice: applicable.unitPrice, entry: applicable };
  }

  async listCoupons(companyId: string) {
    this.tenant.setCompanyId(companyId);
    return this.prisma.couponCode.findMany({
      where: { companyId },
      include: { _count: { select: { usages: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createCoupon(input: {
    companyId: string;
    code: string;
    couponType?: string;
    discountValue: number;
    maxUsages?: number | null;
    maxUsagePerContact?: number | null;
    minOrderAmount?: number | null;
    validFrom?: string | null;
    validTo?: string | null;
    saleChannel?: string | null;
    notes?: string;
    createdByUserId?: string;
  }) {
    this.tenant.setCompanyId(input.companyId);
    const codeKey = input.code.toUpperCase();
    return this.prisma.couponCode.create({
      data: {
        companyId: input.companyId,
        code: input.code,
        codeKey,
        couponType: input.couponType ?? 'PERCENT',
        discountValue: input.discountValue,
        maxUsages: input.maxUsages ?? null,
        maxUsagePerContact: input.maxUsagePerContact ?? null,
        minOrderAmount: input.minOrderAmount ?? null,
        validFrom: input.validFrom ? new Date(input.validFrom) : null,
        validTo: input.validTo ? new Date(input.validTo) : null,
        saleChannel: input.saleChannel ?? null,
        notes: input.notes,
        createdByUserId: input.createdByUserId ?? null,
      },
    });
  }

  async validateCoupon(
    companyId: string,
    code: string,
    orderAmount: number,
    contactId?: string,
    saleChannel?: string,
  ) {
    this.tenant.setCompanyId(companyId);
    const codeKey = code.toUpperCase();
    const coupon = await this.prisma.couponCode.findUnique({
      where: { companyId_codeKey: { companyId, codeKey } },
    });
    if (!coupon || !coupon.isActive) throw new NotFoundException('Coupon not found or inactive');
    const now = new Date();
    if (coupon.validFrom && coupon.validFrom > now) throw new BadRequestException('Coupon not yet valid');
    if (coupon.validTo && coupon.validTo < now) throw new BadRequestException('Coupon expired');
    if (coupon.maxUsages != null && coupon.usageCount >= coupon.maxUsages) {
      throw new BadRequestException('Coupon usage limit reached');
    }
    if (coupon.minOrderAmount != null && orderAmount < Number(coupon.minOrderAmount)) {
      throw new BadRequestException(`Minimum order amount is ${coupon.minOrderAmount}`);
    }
    if (
      coupon.saleChannel &&
      coupon.saleChannel !== 'ALL' &&
      saleChannel &&
      coupon.saleChannel !== saleChannel
    ) {
      throw new BadRequestException('Coupon is not valid for this sales channel');
    }
    if (contactId && coupon.maxUsagePerContact != null) {
      const contactUsages = await this.prisma.couponUsage.count({
        where: { couponId: coupon.id, contactId },
      });
      if (contactUsages >= coupon.maxUsagePerContact) {
        throw new BadRequestException('Per-contact usage limit reached');
      }
    }
    let discountAmount = 0;
    if (coupon.couponType === 'PERCENT') {
      discountAmount = (orderAmount * Number(coupon.discountValue)) / 100;
    } else if (coupon.couponType === 'FIXED_AMOUNT') {
      discountAmount = Math.min(Number(coupon.discountValue), orderAmount);
    }
    return { coupon, discountAmount };
  }

  async applyCoupon(
    companyId: string,
    code: string,
    invoiceId?: string,
    contactId?: string,
    orderAmount = 0,
    saleChannel?: string,
  ) {
    const { coupon } = await this.validateCoupon(
      companyId,
      code,
      orderAmount,
      contactId,
      saleChannel,
    );
    await this.prisma.couponCode.update({
      where: { id: coupon.id },
      data: { usageCount: { increment: 1 } },
    });
    return this.prisma.couponUsage.create({
      data: {
        couponId: coupon.id,
        contactId: contactId ?? null,
        invoiceId: invoiceId ?? null,
      },
    });
  }

  async listBundles(companyId: string) {
    this.tenant.setCompanyId(companyId);
    return this.prisma.productBundle.findMany({
      where: { companyId },
      include: { items: { include: { item: { select: { id: true, name: true } } } } },
      orderBy: { name: 'asc' },
    });
  }

  async createBundle(input: {
    companyId: string;
    name: string;
    sku?: string;
    bundlePrice: number;
    items: Array<{ itemId: string; quantity?: number }>;
  }) {
    this.tenant.setCompanyId(input.companyId);
    return this.prisma.productBundle.create({
      data: {
        companyId: input.companyId,
        name: input.name,
        sku: input.sku,
        bundlePrice: input.bundlePrice,
        items: {
          create: input.items.map((row) => ({
            itemId: row.itemId,
            quantity: row.quantity ?? 1,
          })),
        },
      },
      include: { items: true },
    });
  }
}

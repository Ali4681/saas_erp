import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { GlService } from '../finance/gl.service';
import { CrmOpsService } from './crm-ops.service';

@Injectable()
export class LoyaltyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
    private readonly gl: GlService,
    private readonly ops: CrmOpsService,
  ) {}

  async ensureLoyaltyAccount(companyId: string, contactId: string) {
    this.tenant.setCompanyId(companyId);
    const existing = await this.prisma.loyaltyAccount.findUnique({
      where: { contactId },
    });
    if (existing) return existing;
    return this.prisma.loyaltyAccount.create({
      data: { companyId, contactId },
    });
  }

  async ensureStoreCredit(companyId: string, contactId: string) {
    this.tenant.setCompanyId(companyId);
    const existing = await this.prisma.customerStoreCredit.findUnique({
      where: { contactId },
    });
    if (existing) return existing;
    return this.prisma.customerStoreCredit.create({
      data: { companyId, contactId },
    });
  }

  async getLoyaltyAccount(companyId: string, contactId: string) {
    this.tenant.setCompanyId(companyId);
    const acc = await this.prisma.loyaltyAccount.findUnique({
      where: { contactId },
      include: { events: { orderBy: { createdAt: 'desc' }, take: 50 } },
    });
    if (!acc) return this.ensureLoyaltyAccount(companyId, contactId);
    return acc;
  }

  async getStoreCredit(companyId: string, contactId: string) {
    this.tenant.setCompanyId(companyId);
    const acc = await this.prisma.customerStoreCredit.findUnique({
      where: { contactId },
      include: { events: { orderBy: { createdAt: 'desc' }, take: 50 } },
    });
    if (!acc) return this.ensureStoreCredit(companyId, contactId);
    return acc;
  }

  async earnPoints(input: {
    companyId: string;
    contactId: string;
    points: number;
    sourceType?: string;
    sourceId?: string;
    note?: string;
    userId?: string;
  }) {
    this.tenant.setCompanyId(input.companyId);
    if (!(input.points > 0)) throw new BadRequestException('Points must be > 0');
    if (input.sourceId) {
      const dup = await this.prisma.loyaltyEvent.findFirst({
        where: {
          companyId: input.companyId,
          sourceId: input.sourceId,
          sourceType: input.sourceType ?? 'SALES_INVOICE',
          direction: 'EARN',
        },
      });
      if (dup) {
        return this.prisma.loyaltyAccount.findUniqueOrThrow({
          where: { contactId: input.contactId },
        });
      }
    }
    const acc = await this.ensureLoyaltyAccount(input.companyId, input.contactId);
    await this.prisma.loyaltyAccount.update({
      where: { id: acc.id },
      data: {
        pointsBalance: { increment: input.points },
        lifetimePoints: { increment: input.points },
      },
    });
    await this.prisma.loyaltyEvent.create({
      data: {
        companyId: input.companyId,
        loyaltyAccountId: acc.id,
        eventType: 'EARN',
        direction: 'EARN',
        points: input.points,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        note: input.note,
        createdByUserId: input.userId,
      },
    });
    try {
      await this.gl.ensureChartOfAccounts(input.companyId);
      const mapping = await this.gl.getMapping(input.companyId);
      const pointsValue = Math.round(input.points) / 100;
      if (pointsValue > 0) {
        await this.gl.postJournal({
          companyId: input.companyId,
          userId: input.userId ?? 'system',
          entryType: 'SALES',
          entryDate: new Date(),
          currency: 'SAR',
          memo: `Loyalty points earned (${input.points} pts)`,
          sourceType: 'LOYALTY_EARN',
          sourceId: input.sourceId,
          lines: [
            { code: mapping.salesRevenueCode, debit: pointsValue, credit: 0, memo: 'Defer revenue for loyalty points' },
            { code: mapping.loyaltyLiabilityCode, debit: 0, credit: pointsValue, memo: 'Loyalty liability' },
          ],
        });
      }
    } catch (_) { /* GL posting is best-effort */ }
    await this.notifyLoyalty(
      input.companyId,
      input.contactId,
      `تم إضافة ${input.points} نقطة ولاء.`,
      'نقاط ولاء',
    );
    return this.prisma.loyaltyAccount.findUniqueOrThrow({ where: { id: acc.id } });
  }

  async redeemPoints(input: {
    companyId: string;
    contactId: string;
    points: number;
    sourceType?: string;
    sourceId?: string;
    note?: string;
    userId?: string;
    otpCode?: string;
  }) {
    this.tenant.setCompanyId(input.companyId);
    const settings = await this.ops.getSettings(input.companyId);
    if (settings.loyalty.otpRequired) {
      if (!input.otpCode) {
        throw new BadRequestException('OTP is required to redeem points');
      }
      await this.ops.verifyOtp(
        input.companyId,
        input.contactId,
        'LOYALTY_REDEEM',
        input.otpCode,
      );
    }
    if (!(input.points > 0)) throw new BadRequestException('Points must be > 0');
    const acc = await this.prisma.loyaltyAccount.findUnique({ where: { contactId: input.contactId } });
    if (!acc) throw new NotFoundException('Loyalty account not found');
    if (Number(acc.pointsBalance) < input.points) throw new BadRequestException('Insufficient points');
    await this.prisma.loyaltyAccount.update({
      where: { id: acc.id },
      data: { pointsBalance: { decrement: input.points } },
    });
    await this.prisma.loyaltyEvent.create({
      data: {
        companyId: input.companyId,
        loyaltyAccountId: acc.id,
        eventType: 'REDEEM',
        direction: 'REDEEM',
        points: input.points,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        note: input.note,
        createdByUserId: input.userId,
      },
    });
    try {
      await this.gl.ensureChartOfAccounts(input.companyId);
      const mapping = await this.gl.getMapping(input.companyId);
      const pointsValue = Math.round(input.points) / 100;
      if (pointsValue > 0) {
        await this.gl.postJournal({
          companyId: input.companyId,
          userId: input.userId ?? 'system',
          entryType: 'SALES',
          entryDate: new Date(),
          currency: 'SAR',
          memo: `Loyalty points redeemed (${input.points} pts)`,
          sourceType: 'LOYALTY_REDEEM',
          sourceId: input.sourceId,
          lines: [
            { code: mapping.loyaltyLiabilityCode, debit: pointsValue, credit: 0, memo: 'Clear loyalty liability' },
            { code: mapping.salesCashPosCode, debit: 0, credit: pointsValue, memo: 'Redeemed as discount' },
          ],
        });
      }
    } catch (_) { /* GL posting is best-effort */ }
    await this.notifyLoyalty(
      input.companyId,
      input.contactId,
      `تم استبدال ${input.points} نقطة ولاء.`,
      'استبدال نقاط',
    );
    return this.prisma.loyaltyAccount.findUniqueOrThrow({ where: { id: acc.id } });
  }

  async creditStoreWallet(input: {
    companyId: string;
    contactId: string;
    amount: number;
    sourceType?: string;
    sourceId?: string;
    note?: string;
    userId?: string;
  }) {
    this.tenant.setCompanyId(input.companyId);
    if (!(input.amount > 0)) throw new BadRequestException('Amount must be > 0');
    const acc = await this.ensureStoreCredit(input.companyId, input.contactId);
    await this.prisma.customerStoreCredit.update({
      where: { id: acc.id },
      data: { balance: { increment: input.amount } },
    });
    await this.prisma.storeCreditEvent.create({
      data: {
        companyId: input.companyId,
        storeCreditId: acc.id,
        direction: 'CREDIT',
        amount: input.amount,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        note: input.note,
        createdByUserId: input.userId,
      },
    });
    try {
      await this.gl.ensureChartOfAccounts(input.companyId);
      const mapping = await this.gl.getMapping(input.companyId);
      await this.gl.postJournal({
        companyId: input.companyId,
        userId: input.userId ?? 'system',
        entryType: 'SALES',
        entryDate: new Date(),
        currency: 'SAR',
        memo: `Store credit issued (${input.amount} SAR)`,
        sourceType: 'STORE_CREDIT_ISSUE',
        sourceId: input.sourceId,
        lines: [
          { code: mapping.salesRevenueCode, debit: input.amount, credit: 0, memo: 'Revenue reversal for store credit' },
          { code: mapping.customerStoreCreditCode, debit: 0, credit: input.amount, memo: 'Customer store credit liability' },
        ],
      });
    } catch (_) { /* GL posting is best-effort */ }
    return this.prisma.customerStoreCredit.findUniqueOrThrow({ where: { id: acc.id } });
  }

  async debitStoreWallet(input: {
    companyId: string;
    contactId: string;
    amount: number;
    sourceType?: string;
    sourceId?: string;
    note?: string;
    userId?: string;
  }) {
    this.tenant.setCompanyId(input.companyId);
    if (!(input.amount > 0)) throw new BadRequestException('Amount must be > 0');
    const acc = await this.prisma.customerStoreCredit.findUnique({ where: { contactId: input.contactId } });
    if (!acc) throw new NotFoundException('Store credit account not found');
    if (Number(acc.balance) < input.amount) throw new BadRequestException('Insufficient store credit');
    await this.prisma.customerStoreCredit.update({
      where: { id: acc.id },
      data: { balance: { decrement: input.amount } },
    });
    await this.prisma.storeCreditEvent.create({
      data: {
        companyId: input.companyId,
        storeCreditId: acc.id,
        direction: 'DEBIT',
        amount: input.amount,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        note: input.note,
        createdByUserId: input.userId,
      },
    });
    try {
      await this.gl.ensureChartOfAccounts(input.companyId);
      const mapping = await this.gl.getMapping(input.companyId);
      await this.gl.postJournal({
        companyId: input.companyId,
        userId: input.userId ?? 'system',
        entryType: 'SALES',
        entryDate: new Date(),
        currency: 'SAR',
        memo: `Store credit used (${input.amount} SAR)`,
        sourceType: 'STORE_CREDIT_USE',
        sourceId: input.sourceId,
        lines: [
          { code: mapping.customerStoreCreditCode, debit: input.amount, credit: 0, memo: 'Clear store credit liability' },
          { code: mapping.salesCashPosCode, debit: 0, credit: input.amount, memo: 'Store credit applied as payment' },
        ],
      });
    } catch (_) { /* GL posting is best-effort */ }
    return this.prisma.customerStoreCredit.findUniqueOrThrow({ where: { id: acc.id } });
  }

  private async notifyLoyalty(
    companyId: string,
    contactId: string,
    body: string,
    subject: string,
  ) {
    const contact = await this.prisma.crmContact.findFirst({
      where: { id: contactId, companyId },
    });
    if (!contact) return;
    await this.ops.notifyContact(
      companyId,
      contact.phone,
      contact.email,
      contact.ownerUserId,
      body,
      subject,
    );
  }
}
